import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY } from '$env/static/private';
import OpenAI from 'openai';
import { chooseModel } from '$lib/utils/ai-model';
import type { RequestHandler } from '@sveltejs/kit';

const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export const POST: RequestHandler = async () => {
  try {
    console.log('🤖 Starting swing analysis worker...');
    
    // Get next queued swing
    const { data: swing, error: fetchError } = await adminClient
      .from('pure_swings')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return json({ message: 'No queued swings found', processed: 0 });
      }
      throw fetchError;
    }

    console.log(`🎯 Processing swing ${swing.id} for user ${swing.user_id}`);

    // Update status to processing
    await adminClient
      .from('pure_swings')
      .update({ 
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', swing.id);

    // Analyze swing with GPT-4o
    const analysis = await analyzeSwingWithGPT(swing);
    
    // Update swing with analysis results
    await adminClient
      .from('pure_swings')
      .update({
        status: 'completed',
        ai_flaws: analysis.flaws,
        ai_summary: analysis.summary,
        processed_at: new Date().toISOString()
      })
      .eq('id', swing.id);

    console.log(`✅ Completed analysis for swing ${swing.id}`);

    return json({ 
      message: 'Analysis completed', 
      swing_id: swing.id,
      processed: 1,
      analysis
    });

  } catch (error) {
    console.error('❌ Analysis worker error:', error);
    return json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

async function analyzeSwingWithGPT(swing: any) {
  const model = chooseModel(1000); // Estimate tokens needed
  
  const prompt = `Analyze this golf swing:

Category: ${swing.category}
Upload Mode: ${swing.upload_mode || 'training'}
Video URLs: ${JSON.stringify(swing.video_urls)}

Please provide a detailed analysis including:
1. Key technical flaws (if any)
2. Overall swing score (0-100)
3. Specific recommendations
4. Confidence level in analysis

Focus on the most important 1-2 areas for improvement.`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert golf instructor analyzing swing videos. Provide specific, actionable feedback.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 600,
    temperature: 0.7
  });

  const analysisText = completion.choices[0]?.message?.content || '';
  
  // Parse the response into structured data
  const flaws = extractFlaws(analysisText);
  const score = extractScore(analysisText);
  
  return {
    flaws: {
      swing_score: score,
      primary_flaw: flaws[0] || null,
      secondary_flaw: flaws[1] || null,
      confidence: 0.85
    },
    summary: analysisText
  };
}

function extractFlaws(text: string): string[] {
  // Simple extraction - look for common golf terms
  const flawTerms = [
    'over the top', 'early extension', 'casting', 'chicken wing',
    'reverse pivot', 'sway', 'slide', 'tempo', 'grip', 'setup',
    'ball position', 'alignment', 'posture'
  ];
  
  const found = flawTerms.filter(term => 
    text.toLowerCase().includes(term.toLowerCase())
  );
  
  return found.slice(0, 2); // Return up to 2 flaws
}

function extractScore(text: string): number {
  // Look for score patterns like "75/100" or "score: 82"
  const scorePattern = /(?:score.*?(\d+)|(\d+)\/100|(\d+)\s*out\s*of\s*100)/i;
  const match = text.match(scorePattern);
  
  if (match) {
    const score = parseInt(match[1] || match[2] || match[3]);
    return Math.max(0, Math.min(100, score));
  }
  
  return 75; // Default score if not found
} 