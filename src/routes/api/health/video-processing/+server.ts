/**
 * Video Processing Health Check Endpoint
 * Tests all modular components and provides system status
 */

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { 
  SUPABASE_SERVICE_ROLE_KEY,
  R2_ACCESS_KEY,
  R2_BUCKET_NAME 
} from '$env/static/private';
import { QuotaGuard } from '$lib/auth/quota-guard';
import { R2Validator } from '$lib/storage/r2-validator';
import { R2Organizer } from '$lib/storage/r2-organizer';
import { CloudflareAPI } from '$lib/storage/cloudflare-api';
import type { RequestHandler } from '@sveltejs/kit';

const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const GET: RequestHandler = async () => {
  const startTime = Date.now();
  const healthChecks: Record<string, any> = {};

  try {
    // 1. Test Database Connection
    console.log('🔍 Testing database connection...');
    try {
      const { data, error } = await adminClient
        .from('pure_swings')
        .select('id')
        .limit(1);
      
      healthChecks.database = {
        status: error ? 'error' : 'healthy',
        error: error?.message,
        latency_ms: Date.now() - startTime
      };
    } catch (error) {
      healthChecks.database = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 2. Test R2 Storage
    console.log('☁️ Testing R2 storage...');
    const r2Start = Date.now();
    const r2Health = await R2Validator.healthCheck();
    healthChecks.r2_storage = {
      ...r2Health,
      test_duration_ms: Date.now() - r2Start,
      note: r2Health.healthy ? undefined : 'SSL errors should resolve with custom domain (varro-golf.com)'
    };

    // 2.5. Test Cloudflare API Token
    console.log('🔑 Testing Cloudflare API token...');
    const cfApiStart = Date.now();
    const cfApiHealth = await CloudflareAPI.healthCheck();
    healthChecks.cloudflare_api = {
      ...cfApiHealth,
      test_duration_ms: Date.now() - cfApiStart
    };

    // 3. Test R2 Key Organization
    console.log('🗂️ Testing R2 key organization...');
    try {
      const testKey = R2Organizer.generateKey({
        mode: 'quick',
        userId: 'test-user',
        category: 'iron'
      });
      
      const parsedKey = R2Organizer.parseKey(testKey);
      const isValid = R2Organizer.isValidKey(testKey);
      
      healthChecks.r2_organizer = {
        status: (parsedKey && isValid) ? 'healthy' : 'error',
        test_key: testKey,
        parsed_correctly: !!parsedKey,
        validation_passed: isValid
      };
    } catch (error) {
      healthChecks.r2_organizer = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 4. Test Quota Guard
    console.log('🛡️ Testing quota guard...');
    try {
      const testPlan = 'starter';
      const planLimits = QuotaGuard.getPlanLimits(testPlan);
      const timeToReset = QuotaGuard.getTimeToReset('daily');
      const isValidPlan = QuotaGuard.isValidPlan(testPlan);
      
      healthChecks.quota_guard = {
        status: 'healthy',
        test_plan_limits: planLimits,
        time_to_reset: timeToReset,
        plan_validation: isValidPlan
      };
    } catch (error) {
      healthChecks.quota_guard = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 5. Test Postgres Enums
    console.log('📊 Testing database enums...');
    try {
      const { data: enumValues, error: enumError } = await adminClient
        .rpc('get_enum_values', { enum_name: 'swing_status' })
        .single();
      
      healthChecks.database_enums = {
        status: enumError ? 'error' : 'healthy',
        swing_status_values: enumValues || [],
        error: enumError?.message
      };
    } catch (error) {
      // Fallback: try to query swings table with enum
      try {
        const { error } = await adminClient
          .from('pure_swings')
          .select('status')
          .limit(1);
          
        healthChecks.database_enums = {
          status: error ? 'error' : 'healthy',
          note: 'Enum test via table query',
          error: error?.message
        };
      } catch (fallbackError) {
        healthChecks.database_enums = {
          status: 'error',
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        };
      }
    }

    // 6. Calculate overall health
    const totalTime = Date.now() - startTime;
    const failedChecks = Object.values(healthChecks).filter(check => check.status === 'error');
    const overallStatus = failedChecks.length === 0 ? 'healthy' : 'degraded';

    // 7. Generate system info
    const systemInfo = {
      timestamp: new Date().toISOString(),
      total_check_duration_ms: totalTime,
      checks_performed: Object.keys(healthChecks).length,
      failed_checks: failedChecks.length,
      environment: {
        node_env: process.env.NODE_ENV || 'development',
        has_r2_config: !!(R2_ACCESS_KEY && R2_BUCKET_NAME),
        has_supabase_config: !!(PUBLIC_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
      }
    };

    console.log(`✅ Health check completed in ${totalTime}ms - Status: ${overallStatus}`);

    return json({
      status: overallStatus,
      system_info: systemInfo,
      health_checks: healthChecks,
      version: '1.0.0-phase1'
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      system_info: {
        timestamp: new Date().toISOString(),
        total_check_duration_ms: Date.now() - startTime
      },
      health_checks: healthChecks
    }, { status: 500 });
  }
}; 