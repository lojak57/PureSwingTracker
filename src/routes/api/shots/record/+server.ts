import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';

function validateShot(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.round_id || typeof data.round_id !== 'string') {
    errors.push('round_id is required and must be a string');
  }
  
  if (!data.hole_number || typeof data.hole_number !== 'number' || data.hole_number < 1 || data.hole_number > 18) {
    errors.push('hole_number must be between 1 and 18');
  }
  
  if (!data.shot_number || typeof data.shot_number !== 'number' || data.shot_number < 1) {
    errors.push('shot_number must be a positive number');
  }
  
  if (!data.club_used || typeof data.club_used !== 'string') {
    errors.push('club_used is required');
  }
  
  const validResults = ['green', 'fairway', 'rough', 'sand', 'water', 'trees', 'oob', 'holed'];
  if (!data.shot_result || !validResults.includes(data.shot_result)) {
    errors.push('shot_result must be one of: ' + validResults.join(', '));
  }
  
  if (data.distance_achieved !== undefined && (typeof data.distance_achieved !== 'number' || data.distance_achieved <= 0)) {
    errors.push('distance_achieved must be a positive number');
  }
  
  if (data.distance_to_target !== undefined && (typeof data.distance_to_target !== 'number' || data.distance_to_target <= 0)) {
    errors.push('distance_to_target must be a positive number');
  }
  
  return { isValid: errors.length === 0, errors };
}

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate shot data
    const validation = validateShot(body);
    if (!validation.isValid) {
      return json({ 
        error: 'Invalid shot data',
        details: validation.errors 
      }, { status: 400 });
    }

    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify round ownership
    const { data: roundData, error: roundError } = await supabase
      .from('rounds')
      .select('id, user_id')
      .eq('id', body.round_id)
      .single();

    if (roundError || !roundData || roundData.user_id !== user.id) {
      return json({ error: 'Round not found or not owned by user' }, { status: 404 });
    }

    // Insert the shot
    const { data: shotData, error: shotError } = await supabase
      .from('shots')
      .insert({
        round_id: body.round_id,
        hole_number: body.hole_number,
        shot_number: body.shot_number,
        club_used: body.club_used,
        shot_result: body.shot_result,
        distance_achieved: body.distance_achieved,
        distance_to_target: body.distance_to_target,
        lie_type: body.lie_type,
        accuracy_rating: body.accuracy_rating,
        gps_location: body.gps_location
      })
      .select()
      .single();

    if (shotError) {
      console.error('Error recording shot:', shotError);
      return json({ error: 'Failed to record shot' }, { status: 500 });
    }

    return json({ shot: shotData });

  } catch (error: unknown) {
    console.error('Shot recording error:', error);
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 