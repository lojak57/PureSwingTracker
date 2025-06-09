import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const swingId = params.id;
    
    // Validate swing ID
    if (!swingId) {
      return json(
        { error: { code: 'MISSING_ID', message: 'Swing ID is required' } },
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

    // Fetch swing record from database
    const { data: swing, error: fetchError } = await supabase
      .from('pure.swings')
      .select('*')
      .eq('id', swingId)
      .eq('user_id', user.id) // Ensure user can only access their own swings
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No rows returned
        return json(
          { error: { code: 'SWING_NOT_FOUND', message: 'Swing not found' } },
          { status: 404 }
        );
      }
      
      console.error('Error fetching swing:', fetchError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch swing data' } },
        { status: 500 }
      );
    }

    // Determine processing status
    let status = 'processing';
    if (swing.ai_flaws && swing.ai_summary) {
      status = 'completed';
    } else if (swing.status === 'error') {
      status = 'error';
    }

    // Return swing data with computed status
    return json({
      id: swing.id,
      category: swing.category,
      video_urls: swing.video_urls,
      metadata: swing.metadata || {},
      status,
      created_at: swing.created_at,
      ai_analysis: swing.ai_flaws && swing.ai_summary ? {
        flaws: swing.ai_flaws,
        summary: swing.ai_summary,
        score: swing.ai_flaws?.swing_score || null
      } : null
    });

  } catch (error) {
    console.error('Error retrieving swing:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to retrieve swing data' 
        } 
      },
      { status: 500 }
    );
  }
}; 