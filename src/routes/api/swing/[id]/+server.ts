import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const GET: RequestHandler = async ({ params }) => {
  try {
    const swingId = params.id;
    
    if (!swingId) {
      return json({ error: 'Swing ID is required' }, { status: 400 });
    }
    
    console.log(`🔍 Fetching swing data for ID: ${swingId}`);
    
    // Fetch swing data from database
    const { data: swing, error } = await adminClient
      .from('pure_swings')
      .select('*')
      .eq('id', swingId)
      .single();
    
    if (error) {
      console.error('❌ Database error:', error);
      return json({ error: 'Swing not found' }, { status: 404 });
    }
    
    if (!swing) {
      console.log('❌ No swing found with ID:', swingId);
      return json({ error: 'Swing not found' }, { status: 404 });
    }
    
    console.log(`✅ Found swing: ${swing.id} - ${swing.category} - ${swing.status}`);
    
    return json(swing);
    
  } catch (err) {
    console.error('❌ Server error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 