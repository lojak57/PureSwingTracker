import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from '@sveltejs/kit';

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

    // Extract and verify JWT token with Supabase
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Parse query parameters
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate category filter if provided
    if (category && !['wood', 'iron', 'wedge', 'chip', 'putt'].includes(category)) {
      return json(
        { error: { code: 'INVALID_CATEGORY', message: 'Invalid category filter' } },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('pure.swings')
      .select('id, category, created_at, ai_flaws, ai_summary, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply category filter if provided
    if (category) {
      query = query.eq('category', category);
    }

    // Execute query
    const { data: swings, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching swings:', fetchError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch swing data' } },
        { status: 500 }
      );
    }

    // Transform data to include computed status
    const swingsWithStatus = swings.map(swing => ({
      id: swing.id,
      category: swing.category,
      created_at: swing.created_at,
      metadata: swing.metadata || {},
      status: swing.ai_flaws && swing.ai_summary ? 'completed' : 'processing',
      has_analysis: !!(swing.ai_flaws && swing.ai_summary),
      swing_score: swing.ai_flaws?.swing_score || null
    }));

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('pure.swings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq(category ? 'category' : 'user_id', category || user.id);

    if (countError) {
      console.error('Error counting swings:', countError);
    }

    return json({
      swings: swingsWithStatus,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    });

  } catch (error) {
    console.error('Error listing swings:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to list swings' 
        } 
      },
      { status: 500 }
    );
  }
}; 