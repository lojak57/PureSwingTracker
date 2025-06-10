/**
 * Enhanced Swing Submit Endpoint
 * Production-grade implementation with quota enforcement, R2 validation, and real-time updates
 */

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { QuotaGuard } from '$lib/auth/quota-guard';
import { R2Validator } from '$lib/storage/r2-validator';
import { R2Organizer } from '$lib/storage/r2-organizer';
import type { RequestHandler } from './$types';
import type { UserPlan } from '$lib/auth/quota-guard';
import type { SwingMode } from '$lib/storage/r2-organizer';

interface SwingSubmissionRequest {
  category: 'wood' | 'iron' | 'wedge' | 'chip' | 'putt';
  mode: SwingMode;
  video_urls: {
    down_line?: string;
    face_on?: string;
    overhead?: string;
    single?: string;
  };
  metadata?: {
    club_type?: string;
    notes?: string;
    location?: {
      course_name?: string;
      hole_number?: number;
    };
  };
}

// Create service-role Supabase client for admin operations
const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const POST: RequestHandler = async ({ request }) => {
  const startTime = Date.now();
  let userId: string | null = null;
  
  try {
    console.log('🏌️ Swing submission started');

    // 1. Parse and validate request body
    const body: SwingSubmissionRequest = await request.json();
    const { category, mode, video_urls, metadata } = body;
    
    if (!category || !['wood', 'iron', 'wedge', 'chip', 'putt'].includes(category)) {
      return json(
        { error: { code: 'INVALID_CATEGORY', message: 'Invalid swing category' } },
        { status: 400 }
      );
    }

    if (!mode || !['quick', 'training'].includes(mode)) {
      return json(
        { error: { code: 'INVALID_MODE', message: 'Mode must be "quick" or "training"' } },
        { status: 400 }
      );
    }

    if (!video_urls || Object.keys(video_urls).length === 0) {
      return json(
        { error: { code: 'MISSING_VIDEOS', message: 'Video URLs are required' } },
        { status: 400 }
      );
    }

    // 2. Authenticate with service-role client
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

    userId = user.id;
    console.log(`👤 User authenticated: ${userId}`);

    // 3. Get user profile and plan
    const { data: profile, error: profileError } = await adminClient
      .from('pure_users')
      .select('plan, handicap, goals')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.warn('Failed to get user profile:', profileError);
    }

    const userPlan: UserPlan = QuotaGuard.isValidPlan(profile?.plan) ? profile.plan : 'starter';
    console.log(`📊 User plan: ${userPlan}`);

    // 4. Check quota limits
    const quotaCheck = await QuotaGuard.checkUploadQuota(userId, userPlan, mode);
    
    if (!quotaCheck.allowed) {
      // Record blocked event for analytics
      await QuotaGuard.recordQuotaEvent(userId, 'upload_blocked', {
        reason: quotaCheck.reason,
        mode,
        category
      });

      return json({ 
        error: { 
          code: 'QUOTA_EXCEEDED', 
          message: quotaCheck.reason,
          upgrade_suggestion: quotaCheck.upgrade_suggestion
        } 
      }, { status: 402 });
    }

    console.log(`✅ Quota check passed - remaining: ${quotaCheck.remaining?.daily_uploads} uploads`);

    // 5. Validate videos exist in R2
    console.log('🔍 Validating R2 videos...');
    const validationResult = await R2Validator.validateVideos(video_urls);
    
    if (!validationResult.valid) {
      return json({
        error: { 
          code: 'UPLOAD_VALIDATION_FAILED', 
          message: validationResult.error 
        }
      }, { status: 400 });
    }

    console.log(`📹 Videos validated - total size: ${validationResult.totalSizeMB}MB`);

    // 6. Estimate processing costs
    const estimatedTokens = mode === 'training' ? 2500 : 1200; // Rough estimates
    const estimatedCost = (estimatedTokens / 1000000) * 15; // $15 per 1M tokens

    // 7. Create swing record with enhanced tracking
    const swingData = {
      user_id: userId,
      category,
      video_urls,
      metadata: metadata || {},
      status: 'queued' as const,
      upload_mode: mode,
      r2_validated: true,
      estimated_tokens: estimatedTokens,
      created_at: new Date().toISOString()
    };

    const { data: swing, error: insertError } = await adminClient
      .from('pure_swings')
      .insert(swingData)
      .select()
      .single();

    if (insertError) {
      console.error('Database insert failed:', insertError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to save swing data' } },
        { status: 500 }
      );
    }

    console.log(`💾 Swing record created: ${swing.id}`);

    // 8. Record successful quota usage
    await QuotaGuard.recordQuotaEvent(userId, 'upload_allowed', {
      swing_id: swing.id,
      mode,
      category,
      estimated_cost: estimatedCost
    });

    // 9. TODO: Enqueue for background processing
    // await VideoQueue.enqueue(swing.id, mode, userPlan);

    // 10. Broadcast real-time status update
    await adminClient
      .channel(`swing_status_${userId}`)
      .send({
        type: 'broadcast',
        event: 'swing_queued',
        payload: { 
          swing_id: swing.id, 
          status: 'queued',
          mode,
          category,
          estimated_completion: mode === 'quick' ? '30 seconds' : '2 minutes'
        }
      });

    const processingTime = Date.now() - startTime;
    console.log(`🚀 Swing submission completed in ${processingTime}ms`);

    // Calculate bandwidth savings for monitoring
    const bandwidthSavings = R2Validator.getBandwidthSavings(validationResult.totalSizeMB || 0);

    return json({
      swing_id: swing.id,
      status: 'queued',
      mode,
      estimated_completion: mode === 'quick' ? '30 seconds' : '2 minutes',
      quota_remaining: quotaCheck.remaining,
      processing_stats: {
        submission_time_ms: processingTime,
        estimated_cost: estimatedCost,
        estimated_tokens: estimatedTokens,
        video_size_mb: validationResult.totalSizeMB,
        bandwidth_savings: bandwidthSavings
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Swing submission failed after ${processingTime}ms:`, error);
    
    // Record error for monitoring
    if (userId) {
      await QuotaGuard.recordQuotaEvent(userId, 'upload_blocked', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });
    }

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