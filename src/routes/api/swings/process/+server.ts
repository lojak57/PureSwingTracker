/**
 * Process swing submission with mode-specific handling
 * POST /api/swings/process
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthService } from '../../../../services/auth';
import { processSwingSubmission } from '$lib/modes';
import type { SwingSubmission } from '$lib/modes/types';

interface ProcessRequest {
  swing_id: string;
  mode: 'training' | 'quick';
  metadata: {
    category?: 'wood' | 'iron' | 'wedge' | 'chip' | 'putt';
    club_used?: string;
    intended_target?: string;
    location?: {
      course_name?: string;
      hole_number?: number;
      lie_type?: string;
    };
    context?: {
      practice_session: boolean;
      on_course: boolean;
      lesson: boolean;
    };
  };
  video_urls: string[]; // URLs of uploaded videos
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Check authentication
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: ProcessRequest = await request.json();
    
    // Validate required fields
    if (!body.swing_id || !body.mode || !body.video_urls?.length) {
      return json({ 
        error: 'Missing required fields: swing_id, mode, video_urls' 
      }, { status: 400 });
    }

    // Convert to SwingSubmission format
    // Note: In a real implementation, we'd fetch the actual video files
    // For now, we'll create mock File objects
    const videos = body.video_urls.map((url, index) => ({
      file: new Blob(['mock video data'], { type: 'video/mp4' }) as File,
      angle: body.mode === 'training' 
        ? (['down_line', 'face_on', 'overhead'][index] as any)
        : undefined,
      preview_url: url
    }));

    const submission: SwingSubmission = {
      mode: body.mode,
      videos,
      metadata: body.metadata,
      user_id: user.id
    };

    // Process the swing
    const result = await processSwingSubmission(submission);
    
    // Return processing result
    return json({
      success: true,
      result: {
        swing_id: result.swing_id,
        mode: result.mode,
        processing_time_ms: result.processing_time_ms,
        analysis: {
          flaws: result.analysis.flaws,
          swing_score: result.analysis.swing_score,
          confidence: result.analysis.confidence,
          category_detected: result.analysis.category_detected
        },
        caddy_advice: result.caddy_advice ? {
          club_recommendation: result.caddy_advice.club_recommendation,
          strategy_note: result.caddy_advice.strategy_note,
          confidence: result.caddy_advice.confidence,
          reasoning: result.caddy_advice.reasoning
        } : undefined,
        recommendations: result.recommendations,
        errors: result.errors
      }
    });

  } catch (error) {
    console.error('Swing processing error:', error);
    return json({ 
      success: false,
      error: 'Failed to process swing' 
    }, { status: 500 });
  }
}; 