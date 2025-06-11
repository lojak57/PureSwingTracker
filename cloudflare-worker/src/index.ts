export interface Env {
  GOLF_SWINGS_BUCKET: R2Bucket;
  ALLOWED_ORIGINS: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
          'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-File-Key, X-Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow PUT/POST
    if (request.method !== 'PUT' && request.method !== 'POST') {
      return new Response('Method Not Allowed', { 
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
        }
      });
    }

    try {
      // Get file key from header
      const fileKey = request.headers.get('X-File-Key');
      if (!fileKey) {
        return new Response('Missing X-File-Key header', { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
          }
        });
      }

      // Get content type
      const contentType = request.headers.get('X-Content-Type') || request.headers.get('Content-Type') || 'application/octet-stream';

      // Extract metadata from headers
      const metadata: Record<string, string> = {};
      for (const [key, value] of request.headers.entries()) {
        if (key.startsWith('x-metadata-')) {
          metadata[key.substring(11)] = value; // Remove 'x-metadata-' prefix
        }
      }

      console.log(`🚀 Worker: Uploading ${fileKey} (${contentType})`);

      // Upload directly to R2 using native binding (bypasses S3 API entirely)
      const object = await env.GOLF_SWINGS_BUCKET.put(fileKey, request.body, {
        httpMetadata: {
          contentType: contentType,
          contentLanguage: 'en-US',
        },
        customMetadata: metadata,
      });

      if (!object) {
        throw new Error('Failed to upload to R2');
      }

      console.log(`✅ Worker: Successfully uploaded ${fileKey}`);

      return new Response(JSON.stringify({
        success: true,
        key: fileKey,
        size: object.size,
        etag: object.etag,
        uploaded: true,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
        },
      });

    } catch (error: any) {
      console.error('🚨 Worker error:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Upload failed',
        uploaded: false,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
        },
      });
    }
  },
}; 