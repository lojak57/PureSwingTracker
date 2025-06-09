import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from './$types';
import {
  R2_ACCESS_KEY,
  R2_SECRET_KEY,
  R2_BUCKET_NAME,
  CLOUDFLARE_ACCOUNT_ID
} from '$env/static/private';
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body
    const { category } = await request.json();
    
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Initialize S3 client for Cloudflare R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });

    // Generate unique file names
    const timestamp = Date.now();
    const baseFileName = `${user.id}/${category}/${timestamp}`;
    
    // Generate presigned URLs for each angle
    const angles = ['down_line', 'face_on', 'overhead'] as const;
    const presignedUrls: Record<string, string> = {};

    for (const angle of angles) {
      const key = `${baseFileName}_${angle}.webm`;
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: 'video/webm',
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      presignedUrls[angle] = presignedUrl;
    }

    // Log request for monitoring
    console.log(`Presigned URLs generated for category: ${category}, user: ${user.id}`);

    return json({
      urls: presignedUrls,
      expires_in: 900 // 15 minutes
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

 