import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

// Create admin client for server-side operations
const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const POST: RequestHandler = async ({ request }) => {
  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const { key, category, mode, uploadSession } = await request.json();
    
    if (!key || !category || !mode || !uploadSession) {
      return json(
        { error: { code: 'MISSING_FIELDS', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // 3. Ensure user exists in pure_users table
    console.log('🔍 Ensuring user exists in pure_users table:', user.id);
    const { error: upsertError } = await adminClient
      .from('pure_users')
      .upsert({ 
        id: user.id, 
        email: user.email || `user-${user.id}@temp.com`,
        plan: 'starter'
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('⚠️ User upsert warning (continuing):', upsertError);
    } else {
      console.log('✅ User ensured in pure_users table');
    }

    // 4. Create video URLs via worker proxy
    const workerDomain = 'pure-golf-r2-proxy.varro-golf.workers.dev';
    const workerUrl = `https://${workerDomain}`;
    
    const videoUrls: Record<string, string> = {
      single: `${workerUrl}/${key}`
    };

    // 5. Create swing record for analysis pipeline
    const swingData = {
      user_id: user.id,
      category,
      video_urls: videoUrls,
      metadata: { upload_session: uploadSession },
      status: 'processing'
    };

    console.log('💾 Creating swing record:', swingData);

    const { data: swingRecord, error: insertError } = await adminClient
      .from('pure_swings')
      .insert(swingData)
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Failed to create swing record:', insertError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to create swing record' } },
        { status: 500 }
      );
    }

    console.log('✅ Swing record created:', swingRecord.id);

    // 6. Trigger analysis pipeline
    console.log('🚀 Triggering analysis for swing:', swingRecord.id);
    
    try {
      const analysisResponse = await fetch(`${request.url.replace('/api/swings/create', '/api/swings/analyze')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          swingId: swingRecord.id,
          mode
        })
      });

      if (!analysisResponse.ok) {
        console.error('⚠️ Analysis trigger failed, but swing record created');
      } else {
        console.log('✅ Analysis triggered successfully');
      }
    } catch (analysisError) {
      console.error('⚠️ Analysis trigger error:', analysisError);
      // Don't fail the entire request if analysis fails to trigger
    }

    return json({
      success: true,
      swingId: swingRecord.id
    });

  } catch (error) {
    console.error('❌ Create swing record error:', error);
    return json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}; 