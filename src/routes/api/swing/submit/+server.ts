import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from './$types';
import type { SwingCategory, VideoUrls } from '$lib/supabase';

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body
    const { category, video_urls } = await request.json() as {
      category: SwingCategory;
      video_urls: VideoUrls;
    };

    // Validate required fields
    if (!category || !video_urls) {
      return json(
        { error: { code: 'MISSING_FIELDS', message: 'Category and video_urls are required' } },
        { status: 400 }
      );
    }

    // Validate category
    if (!['wood', 'iron', 'wedge', 'chip', 'putt'].includes(category)) {
      return json(
        { error: { code: 'INVALID_CATEGORY', message: 'Invalid swing category' } },
        { status: 400 }
      );
    }

    // Validate video URLs
    const requiredAngles = ['down_line', 'face_on', 'overhead'] as const;
    for (const angle of requiredAngles) {
      if (!video_urls[angle] || typeof video_urls[angle] !== 'string') {
        return json(
          { error: { code: 'INVALID_VIDEO_URLS', message: `Missing or invalid ${angle} video URL` } },
          { status: 400 }
        );
      }
    }

    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Create swing record in database
    const { data: swing, error: insertError } = await supabase
      .from('swings')
      .insert({
        user_id: user.id,
        category,
        video_urls,
        ai_pose: null, // Will be populated by AI processing
        ai_flaws: null, // Will be populated by AI processing
        ai_summary: null // Will be populated by AI processing
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to create swing record' } },
        { status: 500 }
      );
    }

    // TODO: Enqueue for AI processing
    // In a real implementation, this would trigger:
    // 1. Webhook to pose analysis service
    // 2. Queue job for background processing
    // 3. Real-time status updates via Supabase Realtime
    
    console.log(`Swing submitted: ${swing.id} for user: ${user.id}, category: ${category}`);
    
    // Mock AI processing queue (replace with actual queue integration)
    setTimeout(async () => {
      // Simulate AI processing completion
      const mockAIFlaws = {
        club_category: category,
        primary_flaws: [
          { code: 'over_the_top', severity: 3 },
          { code: 'early_extension', severity: 2 }
        ],
        recommendations: ['split_hand_takeaway', 'slow_motion_transition'],
        swing_score: 72
      };

      await supabase
        .from('swings')
        .update({
          ai_flaws: mockAIFlaws,
          ai_summary: 'Great swing overall! Focus on keeping your swing plane more neutral and maintaining spine angle through impact.'
        })
        .eq('id', swing.id);

      console.log(`Mock AI processing completed for swing: ${swing.id}`);
    }, 5000); // Simulate 5 second processing time

    return json({
      swing_id: swing.id,
      status: 'uploaded',
      message: 'Swing uploaded successfully and queued for analysis'
    });

  } catch (error) {
    console.error('Error submitting swing:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to submit swing' 
        } 
      },
      { status: 500 }
    );
  }
};

// TODO: Real AI processing integration
// Example webhook trigger:
/*
async function enqueueAIProcessing(swingId: string, videoUrls: VideoUrls) {
  const poseServiceUrl = process.env.POSE_SERVICE_URL;
  
  try {
    await fetch(`${poseServiceUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        swing_id: swingId,
        video_urls: videoUrls,
        callback_url: `${process.env.PUBLIC_URL}/api/swing/analysis-complete`
      })
    });
  } catch (error) {
    console.error('Failed to enqueue AI processing:', error);
  }
}
*/ 