import { json } from '@sveltejs/kit';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { 
  SUPABASE_SERVICE_ROLE_KEY,
  R2_ACCESS_KEY,
  R2_SECRET_KEY,
  R2_BUCKET_NAME,
  CLOUDFLARE_ACCOUNT_ID,
  KV_KV_REST_API_URL,
  KV_KV_REST_API_TOKEN
} from '$env/static/private';
import { R2Organizer } from '$lib/storage/r2-organizer';
import type { RequestHandler } from '@sveltejs/kit';
import type { SwingMode } from '$lib/storage/r2-organizer';
import { logger, generateRequestId, withTiming } from '$lib/monitoring/logger';
import type { LogContext } from '$lib/monitoring/logger';

// Create service-role Supabase client
const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Create Redis client for rate limiting
const redis = new Redis({
  url: KV_KV_REST_API_URL,
  token: KV_KV_REST_API_TOKEN,
});

// Configure S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
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

// File validation
const validateFile = (file: File): void => {
  const allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime'];
  const maxFileSize = 200 * 1024 * 1024; // 200MB
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`);
  }
  
  if (file.size > maxFileSize) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 200MB`);
  }
};

// Upload single file to R2
const uploadFileToR2 = async (
  file: File, 
  key: string, 
  userId: string
): Promise<{ key: string; size: number; uploaded: boolean }> => {
  try {
    console.log(`Starting upload - user: ${userId}, key: ${key}, size: ${file.size}`);
    
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: file.stream(),
        ContentType: file.type,
        Metadata: {
          'uploaded-by': userId,
          'upload-timestamp': new Date().toISOString(),
          'original-filename': file.name
        }
      },
    });

    // Wait for upload completion
    await upload.done();
    
    console.log(`Upload successful - key: ${key}`);
    return { key, size: file.size, uploaded: true };
    
  } catch (error) {
    console.error(`Upload failed - key: ${key}, error:`, error);
    throw new Error(`Upload failed for ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // 5. Extract and validate files
    const files: Record<string, File> = {};
    const expectedAngles = mode === 'quick' ? ['single'] : ['down_line', 'face_on', 'overhead'];
    let totalSize = 0;

    for (const angle of expectedAngles) {
      const file = formData.get(`file_${angle}`) as File | null;
      if (!file) {
        return json(
          { error: { code: 'MISSING_FILE', message: `Missing file for angle: ${angle}` } },
          { status: 400 }
        );
      }

      validateFile(file);
      files[angle] = file;
      totalSize += file.size;
    }

    // Check total upload size (600MB max)
    const maxTotalSize = 600 * 1024 * 1024;
    if (totalSize > maxTotalSize) {
      return json(
        { error: { code: 'TOTAL_SIZE_EXCEEDED', message: `Total size too large: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Max: 600MB` } },
        { status: 400 }
      );
    }

    // 6. Generate upload session and keys
    const uploadSession = R2Organizer.generateUploadSession();
    baseContext = { ...baseContext, uploadSession };
    
    logger.uploadStarted({
      ...baseContext,
      metadata: { mode, category, fileCount: Object.keys(files).length, totalSize }
    });

    // 7. Upload files concurrently
    const uploadPromises = Object.entries(files).map(async ([angle, file]) => {
      try {
        const key = R2Organizer.generateKey({
          mode,
          userId,
          category,
          angle: angle as any,
          uploadId: uploadSession
        });

        const result = await uploadFileToR2(file, key, userId);
        return { angle, ...result, error: undefined };
      } catch (error) {
        console.error(`Upload failed for angle ${angle}:`, error);
        return { 
          angle, 
          key: '', 
          size: file.size, 
          uploaded: false, 
          error: error instanceof Error ? error.message : 'Upload failed' 
        };
      }
    });

    const results = await Promise.allSettled(uploadPromises);
    
    // 8. Process results
    const uploadResults: Record<string, any> = {};
    const errors: string[] = [];
    let successCount = 0;

    results.forEach((result, index) => {
      const angle = Object.keys(files)[index];
      
      if (result.status === 'fulfilled') {
        uploadResults[angle] = result.value;
        if (result.value.uploaded) {
          successCount++;
        } else if (result.value.error) {
          errors.push(`${angle}: ${result.value.error}`);
        }
      } else {
        uploadResults[angle] = {
          angle,
          key: '',
          size: files[angle].size,
          uploaded: false,
          error: result.reason?.message || 'Upload failed'
        };
        errors.push(`${angle}: ${result.reason?.message || 'Upload failed'}`);
      }
    });

    const duration = Date.now() - startTime;
    const success = successCount === Object.keys(files).length;

    // 9. Log structured data for monitoring
    if (success) {
      logger.uploadCompleted({
        ...baseContext,
        duration,
        filesUploaded: successCount,
        totalSize
      });
    } else {
      logger.uploadFailed({
        ...baseContext,
        duration,
        reason: `${errors.length} file(s) failed: ${errors.join(', ')}`
      });
    }

    // 10. Return response
    if (success) {
      return json({
        success: true,
        uploadSession,
        results: uploadResults,
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
          results: uploadResults,
          errors,
          metadata: { mode, category, duration, totalSize }
        },
        { status: 207 } // 207 Multi-Status for partial success
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