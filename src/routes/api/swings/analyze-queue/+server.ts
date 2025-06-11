/**
 * Analysis Queue Worker - Processes pending swing analysis jobs
 * POST /api/swings/analyze-queue
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

// Service role client for admin operations
const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const POSE_API_URL = 'http://localhost:3001/metrics';

export const POST: RequestHandler = async ({ request }) => {
  let queueItemId: string | null = null;
  
  try {
    console.log('🔄 Analysis worker started');

    // 1. Get next item with advisory lock (prevents double-processing)
    const { data } = await adminClient.rpc('process_next_analysis');
    queueItemId = data;
    
    if (!queueItemId) {
      return json({ message: 'No jobs in queue' }, { status: 200 });
    }

    console.log(`📋 Processing queue item: ${queueItemId}`);

    // 2. Get full queue item data
    const { data: queueItem } = await adminClient
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
      .single();

    if (!queueItem || !queueItem.pure_swings) {
      throw new Error('Queue item or swing not found');
    }

    const swing = Array.isArray(queueItem.pure_swings) ? queueItem.pure_swings[0] : queueItem.pure_swings;
    console.log(`🏌️ Processing ${swing.category} swing for user ${swing.user_id}`);

    // 3. Call pose service with exponential backoff
    const metrics = await callPoseServiceWithRetry(
      swing.video_urls.single,
      swing.swing_mode || 'quick',
      swing.angle_id || 0,
      swing.metadata?.video_hash
    );

    console.log('📊 Received metrics:', metrics);

    // 4. Store metrics (trigger will update swing status)
    const { error: metricsError } = await adminClient
      .from('swing_metrics')
      .insert({
        swing_id: swing.id,
        tempo_ratio: Number(metrics.tempo_ratio.toFixed(2)),  // Fixed decimals
        plane_delta: Number(metrics.plane_delta.toFixed(1)),
        hip_sway_cm: Number(metrics.hip_sway_cm.toFixed(1)),
        x_factor: metrics.x_factor ? Number(metrics.x_factor.toFixed(1)) : null,
        video_hash: metrics.video_hash,
        confidence: metrics.confidence,
        processing_time_ms: metrics.processing_time_ms,
        cached: metrics.cached || false
      });

    if (metricsError) {
      throw new Error(`Failed to store metrics: ${metricsError.message}`);
    }

    console.log('✅ Metrics stored successfully');

    // 5. Generate coach response with real metrics
    const coachMessage = buildCoachPrompt(swing, metrics);
    
    if (OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: coachMessage }],
            max_tokens: 150,
            temperature: 0.7
          })
        });

        if (response.ok) {
          const aiResult = await response.json();
          const assistantMessage = aiResult.choices[0]?.message?.content || 'Analysis complete! Great swing overall.';

          // 6. Insert chat message
          await adminClient.from('pure_chat_messages').insert({
            swing_id: swing.id,
            user_id: swing.user_id,
            role: 'assistant',
            content: assistantMessage
          });

          console.log('💬 Coach message sent');
        }
      } catch (aiError) {
        console.warn('⚠️ AI response failed, but metrics stored:', aiError);
      }
    } else {
      console.warn('⚠️ No OpenAI key, skipping coach message');
    }

    // 7. Clean up queue (last step for atomicity)
    await adminClient.from('analysis_queue').delete().eq('id', queueItemId);
    
    console.log('🎉 Analysis completed successfully');

    return json({ 
      success: true,
      swing_id: swing.id,
      metrics_stored: true,
      message: 'Analysis completed successfully'
    });

  } catch (error) {
    console.error('❌ Analysis worker error:', error);
    
    // Update error count if we have a queue item
    if (queueItemId) {
      const { data: currentItem } = await adminClient
        .from('analysis_queue')
        .select('attempts')
        .eq('id', queueItemId)
        .single();
      
      const newAttempts = (currentItem?.attempts || 0) + 1;
      
      await adminClient
        .from('analysis_queue')
        .update({
          attempts: newAttempts,
          last_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', queueItemId);

      // Delete if too many attempts
      await adminClient
        .from('analysis_queue')
        .delete()
        .eq('id', queueItemId)
        .gte('attempts', 3);
    }

    return json({ 
      error: error instanceof Error ? error.message : 'Analysis failed',
      success: false
    }, { status: 500 });
  }
};

// Exponential backoff for pose service calls
async function callPoseServiceWithRetry(videoUrl: string, mode: string, angle: number, videoHash?: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎯 Calling pose service (attempt ${attempt})`);
      
      const response = await fetch(POSE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          video_url: videoUrl, 
          mode, 
          angle, 
          video_hash: videoHash 
        })
      });

      if (!response.ok) {
        throw new Error(`Pose service error: ${response.status}`);
      }
      
      return await response.json();

    } catch (error) {
      console.error(`❌ Pose service attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff: 2^attempt seconds
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function buildCoachPrompt(swing: any, metrics: any): string {
  return `You are Coach Oliver. Analyze this ${swing.category} swing using REAL biomechanical data:

ACTUAL METRICS:
- Tempo: ${metrics.tempo_ratio.toFixed(1)} (ideal: 3.0)
- Plane: ${metrics.plane_delta.toFixed(1)}° ${metrics.plane_delta > 0 ? 'steep' : 'shallow'}
- Hip sway: ${metrics.hip_sway_cm.toFixed(1)}cm ${metrics.hip_sway_cm > 4 ? '(sliding)' : '(stable)'}
${metrics.x_factor ? `- X-factor: ${metrics.x_factor.toFixed(0)}° separation` : ''}
- Analysis confidence: ${(metrics.confidence * 100).toFixed(0)}%

Give ONE key improvement and ONE drill. Max 120 words. Be encouraging but specific about the metrics.`;
} 