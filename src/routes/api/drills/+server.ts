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
    const search = url.searchParams.get('search');
    const tags = url.searchParams.get('tags');
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate category filter if provided
    if (category && !['wood', 'iron', 'wedge', 'chip', 'putt', 'general'].includes(category)) {
      return json(
        { error: { code: 'INVALID_CATEGORY', message: 'Invalid category filter' } },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('pure.drills')
      .select('*')
      .order('title', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply category filter
    if (category) {
      query = query.contains('tags', [category]);
    }

    // Apply tags filter
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      query = query.overlaps('tags', tagList);
    }

    // Execute query
    const { data: drills, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching drills:', fetchError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch drills data' } },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('pure.drills')
      .select('*', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category) {
      countQuery = countQuery.contains('tags', [category]);
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      countQuery = countQuery.overlaps('tags', tagList);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting drills:', countError);
    }

    return json({
      drills: drills || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    });

  } catch (error) {
    console.error('Error listing drills:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to list drills' 
        } 
      },
      { status: 500 }
    );
  }
}; 