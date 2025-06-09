import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from '@sveltejs/kit';

interface PracticeLogRequest {
  drill_id: string;
  notes?: string;
  completed_at?: string;
}

export const GET: RequestHandler = async ({ request, url }) => {
  try {
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

    // Parse query parameters
    const drill_id = url.searchParams.get('drill_id');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('pure.practice_logs')
      .select(`
        *,
        pure.drills (
          id,
          title,
          description,
          tags
        )
      `)
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by drill if specified
    if (drill_id) {
      query = query.eq('drill_id', drill_id);
    }

    const { data: logs, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching practice logs:', fetchError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch practice logs' } },
        { status: 500 }
      );
    }

    // Get total count
    let countQuery = supabase
      .from('pure.practice_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (drill_id) {
      countQuery = countQuery.eq('drill_id', drill_id);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting practice logs:', countError);
    }

    return json({
      logs: logs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    });

  } catch (error) {
    console.error('Error listing practice logs:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to list practice logs' 
        } 
      },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body
    const body: PracticeLogRequest = await request.json();
    const { drill_id, notes, completed_at } = body;
    
    // Validate required fields
    if (!drill_id) {
      return json(
        { error: { code: 'MISSING_DRILL_ID', message: 'Drill ID is required' } },
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

    // Verify drill exists
    const { data: drill, error: drillError } = await supabase
      .from('pure.drills')
      .select('id')
      .eq('id', drill_id)
      .single();

    if (drillError || !drill) {
      return json(
        { error: { code: 'DRILL_NOT_FOUND', message: 'Drill not found' } },
        { status: 404 }
      );
    }

    // Insert practice log
    const { data: log, error: insertError } = await supabase
      .from('pure.practice_logs')
      .insert({
        user_id: user.id,
        drill_id,
        notes: notes || '',
        completed_at: completed_at || new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting practice log:', insertError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to log practice' } },
        { status: 500 }
      );
    }

    console.log(`Practice logged: ${log.id} for user: ${user.id}, drill: ${drill_id}`);

    return json({
      log_id: log.id,
      message: 'Practice logged successfully'
    });

  } catch (error) {
    console.error('Error logging practice:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to log practice' 
        } 
      },
      { status: 500 }
    );
  }
}; 