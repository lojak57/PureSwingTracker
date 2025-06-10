import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
import { R2Organizer } from '$lib/storage/r2-organizer';
import type { RequestHandler } from './$types';
import type { SwingMode } from '$lib/storage/r2-organizer';
// Create service-role Supabase client
const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body
    const { category, mode = 'training' }: { category: string; mode?: SwingMode } = await request.json();
    
    // Validate category
    if (!category || !['wood', 'iron', 'wedge', 'chip', 'putt'].includes(category)) {
      return json(
        { error: { code: 'INVALID_CATEGORY', message: 'Invalid swing category' } },
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

    // Extract and verify JWT token with Supabase
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Get R2 endpoint (custom domain or default)
    const r2Endpoint = (R2_CUSTOM_DOMAIN && R2_CUSTOM_DOMAIN !== 'your-custom-domain.com') 
      ? `https://${R2_CUSTOM_DOMAIN}`
      : `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    // Initialize S3 client for Cloudflare R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });

    // Generate upload session for grouped videos
    const uploadSession = R2Organizer.generateUploadSession();
    
    // Generate presigned URLs for each angle based on mode
    const angles = mode === 'quick' ? ['single'] : ['down_line', 'face_on', 'overhead'];
    const presignedUrls: Record<string, string> = {};

    for (const angle of angles) {
      // Use R2Organizer for structured key generation
      const key = R2Organizer.generateKey({
        mode,
        userId: user.id,
        category,
        angle: angle as any,
        uploadId: uploadSession
      });

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: 'video/webm',
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      presignedUrls[angle] = presignedUrl;
    }

    // Log request for monitoring
    console.log(`Presigned URLs generated - mode: ${mode}, category: ${category}, user: ${user.id}, session: ${uploadSession}`);

    return json({
      urls: presignedUrls,
      upload_session: uploadSession,
      mode,
      category,
      expires_in: 900, // 15 minutes
      lifecycle_info: {
        retention_days: mode === 'quick' ? 30 : 365,
        archive_days: mode === 'training' ? 90 : null
      }
    });

  } catch (error) {
    console.error('Error generating presigned URLs:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to generate upload URLs' 
        } 
      },
      { status: 500 }
    );
  }
};

 