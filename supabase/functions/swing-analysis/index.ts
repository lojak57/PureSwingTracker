import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Swing analysis Edge Function started')

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get next item with advisory lock (prevents double-processing)
    const { data: queueItemId } = await supabaseAdmin.rpc('process_next_analysis')
    
    if (!queueItemId) {
      console.log('📭 No jobs in queue')
      return new Response(
        JSON.stringify({ message: 'No jobs in queue' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Processing queue item: ${queueItemId}`)

    // 2. Get full queue item data
    const { data: queueItem } = await supabaseAdmin
      .from('analysis_queue')
      .select(`
        id,
        swing_id,
        attempts,
        pure_swings (
          id,
          user_id,
          category,
          video_urls,
          swing_mode,
          angle_id,
          metadata
        )
      `)
      .eq('id', queueItemId)
      .single()

    if (!queueItem || !queueItem.pure_swings) {
      throw new Error('Queue item or swing not found')
    }

    const swing = Array.isArray(queueItem.pure_swings) ? queueItem.pure_swings[0] : queueItem.pure_swings
    console.log(`🏌️ Processing ${swing.category} swing for user ${swing.user_id}`)

    // 3. Call Modal pose service with exponential backoff
    const poseApiUrl = Deno.env.get('POSE_API_URL')
    if (!poseApiUrl) {
      throw new Error('POSE_API_URL not configured')
    }

    const metrics = await callPoseServiceWithRetry(
      poseApiUrl,
      swing.video_urls.single,
      swing.swing_mode || 'quick',
      swing.angle_id || 0,
      swing.metadata?.video_hash
    )

    console.log('📊 Received metrics:', metrics)

    // 4. Store metrics (trigger will update swing status)
    const { error: metricsError } = await supabaseAdmin
      .from('swing_metrics')
      .insert({
        swing_id: swing.id,
        tempo_ratio: Number(metrics.tempo_ratio?.toFixed(2)) || null,
        plane_delta: Number(metrics.plane_delta?.toFixed(1)) || null,
        hip_sway_cm: Number(metrics.hip_sway_cm?.toFixed(1)) || null,
        x_factor: metrics.x_factor ? Number(metrics.x_factor.toFixed(1)) : null,
        video_hash: metrics.video_hash,
        confidence: metrics.confidence,
        processing_time_ms: metrics.processing_time_ms,
        cached: metrics.cached || false
      })

    if (metricsError) {
      throw new Error(`Failed to store metrics: ${metricsError.message}`)
    }

    console.log('✅ Metrics stored successfully')

    // 5. Generate coach response with real metrics
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (openaiKey && metrics.tempo_ratio) {
      try {
        const coachMessage = buildCoachPrompt(swing, metrics)
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: coachMessage }],
            max_tokens: 150,
            temperature: 0.7
          })
        })

        if (response.ok) {
          const aiResult = await response.json()
          const assistantMessage = aiResult.choices[0]?.message?.content || 'Analysis complete! Great swing overall.'

          // 6. Insert chat message
          await supabaseAdmin.from('pure_chat_messages').insert({
            swing_id: swing.id,
            user_id: swing.user_id,
            role: 'assistant',
            content: assistantMessage
          })

          console.log('💬 Coach message sent')
        }
      } catch (aiError) {
        console.warn('⚠️ AI response failed, but metrics stored:', aiError)
      }
    } else {
      console.warn('⚠️ No OpenAI key or invalid metrics, skipping coach message')
    }

    // 7. Clean up queue (last step for atomicity)
    await supabaseAdmin.from('analysis_queue').delete().eq('id', queueItemId)
    
    console.log('🎉 Analysis completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        swing_id: swing.id,
        metrics_stored: true,
        message: 'Analysis completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Analysis Edge Function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Analysis failed',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Exponential backoff for pose service calls
async function callPoseServiceWithRetry(
  poseApiUrl: string,
  videoUrl: string, 
  mode: string, 
  angle: number, 
  videoHash?: string, 
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎯 Calling pose service (attempt ${attempt}): ${poseApiUrl}`)
      
      const response = await fetch(poseApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          video_url: videoUrl, 
          mode, 
          angle, 
          video_hash: videoHash 
        })
      })

      if (!response.ok) {
        throw new Error(`Pose service error: ${response.status}`)
      }
      
      return await response.json()

    } catch (error) {
      console.error(`❌ Pose service attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) throw error
      
      // Exponential backoff: 2^attempt seconds
      const delay = Math.pow(2, attempt) * 1000
      console.log(`⏳ Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

function buildCoachPrompt(swing: any, metrics: any): string {
  return `You are Coach Oliver. Analyze this ${swing.category} swing using REAL biomechanical data:

ACTUAL METRICS:
- Tempo: ${metrics.tempo_ratio?.toFixed(1) || 'N/A'} (ideal: 3.0)
- Plane: ${metrics.plane_delta?.toFixed(1) || 'N/A'}° ${metrics.plane_delta > 0 ? 'steep' : 'shallow'}
- Hip sway: ${metrics.hip_sway_cm?.toFixed(1) || 'N/A'}cm ${metrics.hip_sway_cm > 4 ? '(sliding)' : '(stable)'}
${metrics.x_factor ? `- X-factor: ${metrics.x_factor.toFixed(0)}° separation` : ''}
- Analysis confidence: ${metrics.confidence ? (metrics.confidence * 100).toFixed(0) : 'N/A'}%

Give ONE key improvement and ONE drill. Max 120 words. Be encouraging but specific about the metrics.`
} 