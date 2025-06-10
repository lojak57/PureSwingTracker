import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from '@sveltejs/kit';
import { getCourseById } from '../../../../services/course';

interface UpdateRoundRequest {
  status?: 'in_progress' | 'completed' | 'abandoned';
  total_score?: number;
  weather?: {
    temperature?: number;
    wind_speed?: number;
    wind_direction?: string;
    conditions?: string;
  };
  notes?: string;
}

// GET round details
export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const roundId = params.id;
    
    if (!roundId) {
      return json(
        { 
          error: { 
            code: 'MISSING_ROUND_ID', 
            message: 'Round ID is required' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(roundId)) {
      return json(
        { 
          error: { 
            code: 'INVALID_ROUND_ID', 
            message: 'Round ID must be a valid UUID' 
          } 
        },
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

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('pure.rounds')
      .select('*')
      .eq('id', roundId)
      .eq('user_id', user.id) // Ensure user owns the round
      .single();

    if (roundError || !round) {
      console.error('Error fetching round:', roundError);
      return json(
        { 
          error: { 
            code: 'ROUND_NOT_FOUND', 
            message: 'Round not found' 
          } 
        },
        { status: 404 }
      );
    }

    // Get course details
    const course = await getCourseById(round.course_id);
    
    // Get shots for this round
    const { data: shots, error: shotsError } = await supabase
      .from('pure.shots')
      .select('*')
      .eq('round_id', roundId)
      .order('hole_number', { ascending: true })
      .order('shot_number', { ascending: true });

    if (shotsError) {
      console.error('Error fetching shots:', shotsError);
      // Continue anyway, just return empty shots array
    }

    return json({
      round: {
        ...round,
        course
      },
      shots: shots || [],
      shot_count: shots?.length || 0
    });

  } catch (error) {
    console.error('Error in get round endpoint:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch round details' 
        } 
      },
      { status: 500 }
    );
  }
};

// PUT - Update round (including finish/abandon)
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const roundId = params.id;
    
    if (!roundId) {
      return json(
        { 
          error: { 
            code: 'MISSING_ROUND_ID', 
            message: 'Round ID is required' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(roundId)) {
      return json(
        { 
          error: { 
            code: 'INVALID_ROUND_ID', 
            message: 'Round ID must be a valid UUID' 
          } 
        },
        { status: 400 }
      );
    }

    // Parse request body
    const body: UpdateRoundRequest = await request.json();
    const { status, total_score, weather, notes } = body;

    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Check if round exists and user owns it
    const { data: existingRound, error: checkError } = await supabase
      .from('pure.rounds')
      .select('*')
      .eq('id', roundId)
      .eq('user_id', user.id)
      .single();

    if (checkError || !existingRound) {
      console.error('Error checking round:', checkError);
      return json(
        { 
          error: { 
            code: 'ROUND_NOT_FOUND', 
            message: 'Round not found' 
          } 
        },
        { status: 404 }
      );
    }

    // Validate status if provided
    if (status && !['in_progress', 'completed', 'abandoned'].includes(status)) {
      return json(
        { 
          error: { 
            code: 'INVALID_STATUS', 
            message: 'Status must be one of: in_progress, completed, abandoned' 
          } 
        },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {};
    
    if (status !== undefined) {
      updateData.status = status;
      
      // Set finished_at if completing or abandoning
      if (status === 'completed' || status === 'abandoned') {
        updateData.finished_at = new Date().toISOString();
      }
    }
    
    if (total_score !== undefined) {
      updateData.total_score = total_score;
    }
    
    if (weather !== undefined) {
      updateData.weather = weather;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // If no updates provided
    if (Object.keys(updateData).length === 0) {
      return json(
        { 
          error: { 
            code: 'NO_UPDATES', 
            message: 'No valid updates provided' 
          } 
        },
        { status: 400 }
      );
    }

    // Update round
    const { data: updatedRound, error: updateError } = await supabase
      .from('pure.rounds')
      .update(updateData)
      .eq('id', roundId)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating round:', updateError);
      return json(
        { 
          error: { 
            code: 'DATABASE_ERROR', 
            message: 'Failed to update round' 
          } 
        },
        { status: 500 }
      );
    }

    // Get course details for response
    const course = await getCourseById(updatedRound.course_id);

    return json({
      round: {
        ...updatedRound,
        course
      },
      message: `Round ${status === 'completed' ? 'completed' : status === 'abandoned' ? 'abandoned' : 'updated'} successfully`
    });

  } catch (error) {
    console.error('Error in update round endpoint:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to update round' 
        } 
      },
      { status: 500 }
    );
  }
};

// DELETE - Delete round (optional, for cleanup)
export const DELETE: RequestHandler = async ({ params, request }) => {
  try {
    const roundId = params.id;
    
    if (!roundId) {
      return json(
        { 
          error: { 
            code: 'MISSING_ROUND_ID', 
            message: 'Round ID is required' 
          } 
        },
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

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Delete round (this will cascade delete shots due to FK constraints)
    const { error: deleteError } = await supabase
      .from('pure.rounds')
      .delete()
      .eq('id', roundId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting round:', deleteError);
      return json(
        { 
          error: { 
            code: 'DATABASE_ERROR', 
            message: 'Failed to delete round' 
          } 
        },
        { status: 500 }
      );
    }

    return json({
      message: 'Round deleted successfully'
    });

  } catch (error) {
    console.error('Error in delete round endpoint:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to delete round' 
        } 
      },
      { status: 500 }
    );
  }
}; 