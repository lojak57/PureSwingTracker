import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from '@sveltejs/kit';
import { getCourseById } from '../../../../services/course';

interface StartRoundRequest {
  course_id: string;
  tee_set: string;
  weather?: {
    temperature?: number;
    wind_speed?: number;
    wind_direction?: string;
    conditions?: string;
  };
  notes?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body
    const body: StartRoundRequest = await request.json();
    const { course_id, tee_set, weather, notes } = body;

    // Validate required fields
    if (!course_id || !tee_set) {
      return json(
        { 
          error: { 
            code: 'MISSING_REQUIRED_FIELDS', 
            message: 'Course ID and tee set are required' 
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

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Validate UUID format for course_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(course_id)) {
      return json(
        { 
          error: { 
            code: 'INVALID_COURSE_ID', 
            message: 'Course ID must be a valid UUID' 
          } 
        },
        { status: 400 }
      );
    }

    // Verify course exists and get course details
    const course = await getCourseById(course_id);
    if (!course) {
      return json(
        { 
          error: { 
            code: 'COURSE_NOT_FOUND', 
            message: 'Course not found' 
          } 
        },
        { status: 404 }
      );
    }

    // Validate tee set exists for this course
    const firstHole = course.holes?.[0];
    if (!firstHole?.yardages?.[tee_set]) {
      return json(
        { 
          error: { 
            code: 'INVALID_TEE_SET', 
            message: `Tee set '${tee_set}' is not available for this course` 
          } 
        },
        { status: 400 }
      );
    }

    // Check for existing active round
    const { data: existingRound, error: checkError } = await supabase
      .from('pure.rounds')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking for existing round:', checkError);
      return json(
        { 
          error: { 
            code: 'DATABASE_ERROR', 
            message: 'Failed to check for existing rounds' 
          } 
        },
        { status: 500 }
      );
    }

    if (existingRound) {
      return json(
        { 
          error: { 
            code: 'ROUND_IN_PROGRESS', 
            message: 'You already have a round in progress. Please finish or abandon it before starting a new one.' 
          } 
        },
        { status: 409 }
      );
    }

    // Create new round
    const roundData = {
      user_id: user.id,
      course_id,
      tee_set,
      started_at: new Date().toISOString(),
      status: 'in_progress' as const,
      weather: weather || null,
      notes: notes || null
    };

    const { data: newRound, error: insertError } = await supabase
      .from('pure.rounds')
      .insert(roundData)
      .select('*')
      .single();

    if (insertError) {
      console.error('Error creating round:', insertError);
      return json(
        { 
          error: { 
            code: 'DATABASE_ERROR', 
            message: 'Failed to create round' 
          } 
        },
        { status: 500 }
      );
    }

    // Return the created round with course data
    return json({
      round: {
        ...newRound,
        course: {
          id: course.id,
          name: course.name,
          location: course.location,
          holes: course.holes
        }
      },
      message: 'Round started successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in start round endpoint:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to start round' 
        } 
      },
      { status: 500 }
    );
  }
}; 