import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from './$types';

interface SwingSubmissionRequest {
  category: 'wood' | 'iron' | 'wedge' | 'chip' | 'putt';
  video_urls: {
    down_line: string;
    face_on: string;
    overhead: string;
  };
  metadata?: {
    club_type?: string;
    notes?: string;
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body
    const body: SwingSubmissionRequest = await request.json();
    const { category, video_urls, metadata } = body;
    
    // Validate required fields
    if (!category || !['wood', 'iron', 'wedge', 'chip', 'putt'].includes(category)) {
      return json(
        { error: { code: 'INVALID_CATEGORY', message: 'Invalid swing category' } },
        { status: 400 }
      );
    }

    if (!video_urls || !video_urls.down_line || !video_urls.face_on || !video_urls.overhead) {
      return json(
        { error: { code: 'MISSING_VIDEOS', message: 'All three video angles are required' } },
        { status: 400 }
      );
    }

    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Extract and verify JWT token with Supabase
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Insert swing record into database
    const { data: swing, error: insertError } = await supabase
      .from('pure.swings')
      .insert({
        user_id: user.id,
        category,
        video_urls,
        metadata: metadata || {},
        status: 'processing', // Will be updated when AI analysis completes
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting swing:', insertError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to save swing data' } },
        { status: 500 }
      );
    }

    // TODO: Enqueue for AI processing
    // For MVP, we'll skip AI processing and return the swing ID
    // In production, this would trigger pose analysis and GPT feedback

    console.log(`Swing submitted successfully: ${swing.id} for user: ${user.id}`);

    return json({
      swing_id: swing.id,
      status: 'submitted',
      message: 'Swing submitted successfully for analysis'
    });

  } catch (error) {
    console.error('Error submitting swing:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to submit swing data' 
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