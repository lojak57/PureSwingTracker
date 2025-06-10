import { json } from '@sveltejs/kit';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { 
  SUPABASE_SERVICE_ROLE_KEY,
  R2_ACCESS_KEY,
  R2_SECRET_KEY,
  R2_BUCKET_NAME,
  CLOUDFLARE_ACCOUNT_ID
} from '$env/static/private';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';

// Configure clients
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Create Redis client for rate limiting health check
const redis = new Redis({
  url: env.KV_KV_REST_API_URL || '',
  token: env.KV_KV_REST_API_TOKEN || '',
});

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    r2_connectivity: { status: 'pass' | 'fail'; response_time_ms?: number; error?: string };
    supabase_auth: { status: 'pass' | 'fail'; response_time_ms?: number; error?: string };
    rate_limiting: { status: 'pass' | 'fail'; response_time_ms?: number; error?: string };
    memory: { status: 'pass' | 'warn' | 'fail'; usage_mb?: number; available_mb?: number; error?: string };
  };
  uptime_seconds: number;
}

const startTime = Date.now();

export const GET: RequestHandler = async () => {
  const checks: HealthCheck['checks'] = {
    r2_connectivity: { status: 'fail' },
    supabase_auth: { status: 'fail' },
    rate_limiting: { status: 'fail' },
    memory: { status: 'fail' }
  };

  // 1. Check R2 connectivity
  try {
    const r2Start = Date.now();
    await s3Client.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    checks.r2_connectivity = { 
      status: 'pass', 
      response_time_ms: Date.now() - r2Start 
    };
  } catch (error) {
    checks.r2_connectivity = { 
      status: 'fail', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }

  // 2. Check Supabase auth
  try {
    const authStart = Date.now();
    const { error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw error;
    checks.supabase_auth = { 
      status: 'pass', 
      response_time_ms: Date.now() - authStart 
    };
  } catch (error) {
    checks.supabase_auth = { 
      status: 'fail', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }

  // 3. Check rate limiting (Redis store)
  try {
    const redisStart = Date.now();
    const testKey = `health_check:${Date.now()}`;
    await redis.set(testKey, 'test', { ex: 1 });
    await redis.get(testKey);
    await redis.del(testKey);
    checks.rate_limiting = { 
      status: 'pass', 
      response_time_ms: Date.now() - redisStart 
    };
  } catch (error) {
    checks.rate_limiting = { 
      status: 'fail', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }

  // 4. Check memory usage (estimate)
  try {
    const memoryUsage = process.memoryUsage();
    const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const availableMB = 1024 - usedMB; // Vercel function limit
    
    let memoryStatus: 'pass' | 'warn' | 'fail' = 'pass';
    if (usedMB > 800) memoryStatus = 'fail';  // > 80% of 1GB
    else if (usedMB > 600) memoryStatus = 'warn'; // > 60% of 1GB
    
    checks.memory = {
      status: memoryStatus,
      usage_mb: usedMB,
      available_mb: availableMB
    };
  } catch (error) {
    checks.memory = { 
      status: 'fail', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }

  // Determine overall status
  const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length;
  const degradedChecks = Object.values(checks).filter(check => check.status === 'warn').length;
  
  let overallStatus: HealthCheck['status'] = 'healthy';
  if (failedChecks > 0) overallStatus = 'unhealthy';
  else if (degradedChecks > 0) overallStatus = 'degraded';

  const health: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks,
    uptime_seconds: Math.round((Date.now() - startTime) / 1000)
  };

  // Return appropriate HTTP status
  const httpStatus = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503;

  return json(health, { status: httpStatus });
}; 