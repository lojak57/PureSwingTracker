import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { 
  SUPABASE_SERVICE_ROLE_KEY,
  R2_ACCESS_KEY,
  R2_SECRET_KEY,
  R2_BUCKET_NAME,
  CLOUDFLARE_ACCOUNT_ID,
  R2_CUSTOM_DOMAIN
} from '$env/static/private';
import { env } from '$env/dynamic/private';
import { R2Organizer } from '$lib/storage/r2-organizer';
import type { RequestHandler } from '@sveltejs/kit';
import type { SwingMode } from '$lib/storage/r2-organizer';
import { logger, generateRequestId, withTiming } from '$lib/monitoring/logger';
import type { LogContext } from '$lib/monitoring/logger';

// Create service-role Supabase client
const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Create Redis client for rate limiting
const redis = new Redis({
  url: env.KV_KV_REST_API_URL || '',
  token: env.KV_KV_REST_API_TOKEN || '',
});

// LAST RESORT: Use default endpoint with forcePathStyle to bypass SSL handshake
const r2Endpoint = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const useCustomDomain = false;

console.log('🔧 LAST RESORT CONFIG - Path Style Addressing:', {
  r2Endpoint,
  forcePathStyle: true,
  reason: 'Using path-style requests to bypass SSL handshake failures'
});

// Create custom HTTPS agent to handle SSL handshake issues
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Allow self-signed certificates
  secureProtocol: 'TLSv1_2_method', // Force TLS 1.2
  keepAlive: true,
  timeout: 30000,
});

const s3Client = new S3Client({
  region: 'auto',
  endpoint: r2Endpoint,
  
  // LAST RESORT: Force path-style addressing to bypass SSL handshake issues
  forcePathStyle: true,      // Use path-style requests (endpoint.com/bucket/key)
  
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent,
    connectionTimeout: 30000,
    requestTimeout: 60000,
  }),
});

// Rate limiting using Upstash Redis
const checkRateLimit = async (userId: string): Promise<boolean> => {
  const now = Date.now();
  const key = `rate_limit:${userId}`;
  
  try {
    // Get current rate limit data from Redis
    const userLimit = await redis.get<{ count: number; resetTime: number }>(key);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize rate limit window (10 uploads per minute)
      await redis.set(key, { count: 1, resetTime: now + 60000 }, { ex: 60 });
      return true;
    }
    
    if (userLimit.count >= 10) {
      return false; // Rate limit exceeded
    }
    
    // Increment counter in distributed store
    userLimit.count++;
    await redis.set(key, userLimit, { ex: 60 });
    return true;
  } catch (error) {
    console.warn('Rate limiting check failed, allowing request:', error);
    return true; // Fail open if Redis is unavailable
  }
};

// File validation - Single video mode
const validateFile = (file: File): void => {
  const allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime'];
  const maxFileSize = 25 * 1024 * 1024; // 25MB max for iPhone videos
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`);
  }
  
  if (file.size > maxFileSize) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 25MB`);
  }
};

// Upload single file to R2
const uploadFileToWorker = async (
  file: File, 
  key: string, 
  userId: string
): Promise<{ key: string; size: number; uploaded: boolean }> => {
  try {
    console.log(`🔧 WORKER PROXY: Starting upload via Cloudflare Worker - user: ${userId}, key: ${key}, size: ${file.size}`);
    
    // Cloudflare Worker R2 Proxy URL from environment
    const workerDomain = env.WORKER_R2_PROXY_URL || 'pure-golf-r2-proxy.varro-golf.workers.dev';
    const workerUrl = workerDomain.startsWith('http') ? workerDomain : `https://${workerDomain}`;
    
    const response = await fetch(workerUrl, {
      method: 'PUT',
      headers: {
        'X-File-Key': key,
        'X-Content-Type': file.type,
        'X-Metadata-uploaded-by': userId,
        'X-Metadata-upload-timestamp': new Date().toISOString(),
        'X-Metadata-original-filename': file.name,
        'Content-Type': file.type,
      },
      body: file.stream(),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Worker upload SUCCESS:', result);
    
    return { 
      key: result.key || key, 
      size: result.size || file.size, 
      uploaded: result.success || false 
    };
    
  } catch (error) {
    console.error('🚨 Worker upload error:', error);
    throw error;
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const startTime = Date.now();
  const requestId = generateRequestId();
  let userId = '';
  let baseContext: LogContext = { requestId };
  
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
    
    userId = user.id;
    baseContext = { ...baseContext, userId };

    // 2. Rate limiting
    const rateLimitPassed = await checkRateLimit(userId);
    if (!rateLimitPassed) {
      logger.rateLimitHit(baseContext);
      return json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many uploads. Try again in a minute.' } },
        { status: 429 }
      );
    }

    // 3. Parse multipart form data
    const formData = await request.formData();
    const category = formData.get('category') as string;
    const mode = (formData.get('mode') as SwingMode) || 'training';

    // 4. Validate metadata
    if (!category || !['wood', 'iron', 'wedge', 'chip', 'putt'].includes(category)) {
      return json(
        { error: { code: 'INVALID_CATEGORY', message: 'Invalid swing category' } },
        { status: 400 }
      );
    }

    // 5. Extract and validate single video file
    const videoFile = formData.get('video') as File | null;
    if (!videoFile) {
      return json(
        { error: { code: 'MISSING_FILE', message: 'Missing video file' } },
        { status: 400 }
      );
    }

    validateFile(videoFile);
    const totalSize = videoFile.size;

    // 6. Generate upload session and key
    const uploadSession = R2Organizer.generateUploadSession();
    baseContext = { ...baseContext, uploadSession };
    
    logger.uploadStarted({
      ...baseContext,
      metadata: { mode, category, fileCount: 1, totalSize }
    });

    // 7. Upload single video file
    let uploadResult: any;
    let success = false;
    const errors: string[] = [];

    try {
      const key = R2Organizer.generateKey({
        mode,
        userId,
        category,
        angle: 'single' as any,
        uploadId: uploadSession
      });

      const result = await uploadFileToWorker(videoFile, key, userId);
      uploadResult = { ...result, error: undefined };
      success = result.uploaded;
    } catch (error) {
      // Capture debug details if available
      const debugDetails = (error as any)?.debugDetails || null;
      
      uploadResult = { 
        key: '', 
        size: videoFile.size, 
        uploaded: false, 
        error: error instanceof Error ? error.message : 'Upload failed',
        debugDetails // Include debug info in result
      };
      errors.push(error instanceof Error ? error.message : 'Upload failed');
    }

    const duration = Date.now() - startTime;

    // 8. Log structured data for monitoring
    if (success) {
      logger.uploadCompleted({
        ...baseContext,
        duration,
        filesUploaded: 1,
        totalSize
      });
    } else {
      logger.uploadFailed({
        ...baseContext,
        duration,
        reason: `Upload failed: ${errors.join(', ')}`
      });
    }

    // 9. Create swing record for analysis if upload successful
    let swingId;
    if (success) {
      try {
        // First, ensure user exists in pure_users table
        console.log('🔍 Ensuring user exists in pure_users table:', userId);
        const { error: upsertError } = await adminClient
          .from('pure_users')
          .upsert({ 
            id: userId, 
            email: user.email || `user-${userId}@temp.com`,
            plan: 'starter'
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error('⚠️ User upsert warning (continuing):', upsertError);
        } else {
          console.log('✅ User ensured in pure_users table');
        }

        // Create video URL via worker proxy (bypasses SSL issues)
        const workerDomain = env.WORKER_R2_PROXY_URL || 'pure-golf-r2-proxy.varro-golf.workers.dev';
        const workerUrl = workerDomain.startsWith('http') ? workerDomain : `https://${workerDomain}`;
        
        const videoUrls: Record<string, string> = {
          single: `${workerUrl}/${uploadResult.key}`
        };

        // Create swing record with pose metrics support
        const swingData = {
          user_id: userId,
          category,
          video_urls: videoUrls,
          metadata: { 
            upload_session: uploadSession,
            video_hash: null // Will be calculated by pose service
          },
          status: 'queued' as const,
          upload_mode: mode,
          swing_mode: 'quick' as const, // Default to quick mode
          angle_id: 0,
          r2_validated: true,
          created_at: new Date().toISOString()
        };

        console.log('🔍 Attempting to create swing record with user_id:', userId);
        console.log('🔍 Full swing data:', swingData);
        
        const { data: swing, error: insertError } = await adminClient
          .from('pure_swings')
          .insert(swingData)
          .select()
          .single();

        if (insertError) {
          console.error('❌ Swing creation error:', insertError);
        } else if (swing) {
          swingId = swing.id;
          console.log(`💾 Swing record created: ${swing.id} for pose metrics pipeline`);

          // Enqueue for pose analysis
          try {
            await adminClient.rpc('enqueue_analysis_job', { p_swing_id: swing.id });
            console.log(`🔄 Analysis job queued for swing: ${swing.id}`);
            
            // Analysis will be handled by Supabase Edge Function automatically
            
          } catch (queueError) {
            console.error('⚠️ Failed to queue analysis job:', queueError);
          }
        } else {
          console.error('❌ No swing returned and no error');
        }
      } catch (error) {
        console.warn('Failed to create swing record:', error);
        // Don't fail the entire upload if swing creation fails
      }
    }

    // 10. Return response
    if (success) {
      return json({
        success: true,
        uploadSession,
        swingId, // Include swing ID for navigation
        result: uploadResult,
        metadata: {
          mode,
          category,
          duration,
          totalSize,
          lifecycle_info: {
            retention_days: mode === 'quick' ? 30 : 365,
            archive_days: mode === 'training' ? 90 : null
          }
        }
      });
    } else {
      return json(
        {
          success: false,
          uploadSession,
          result: uploadResult,
          errors,
          metadata: { mode, category, duration, totalSize }
        },
        { status: 400 } // Bad request for single file failure
      );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Upload endpoint error:', {
      userId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Upload failed due to server error' 
        } 
      },
      { status: 500 }
    );
  }
}; 