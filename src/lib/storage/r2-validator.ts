/**
 * R2 Validator Service
 * Validates video uploads and generates streaming URLs for pose analysis
 * Implements production-grade error handling and retry logic
 */

import { S3Client, HeadObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { 
  R2_ACCESS_KEY, 
  R2_SECRET_KEY, 
  R2_BUCKET_NAME, 
  CLOUDFLARE_ACCOUNT_ID,
  R2_CUSTOM_DOMAIN 
} from '$env/static/private';

export interface VideoUrls {
  down_line?: string;
  face_on?: string;
  overhead?: string;
  single?: string;
  [key: string]: string | undefined;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  videoSizes?: Record<string, number>;
  totalSizeMB?: number;
}

export interface StreamingUrls {
  video_urls: Record<string, string>;
  expires_at: string;
  request_id: string;
}

export interface VideoMetadata {
  key: string;
  size: number;
  lastModified: Date;
  contentType: string;
  exists: boolean;
}

export class R2Validator {
  private static s3Client: S3Client | null = null;

  /**
   * Get R2 endpoint URL (custom domain or default)
   */
  private static getR2Endpoint(): string {
    // Use custom domain if configured, otherwise use default Cloudflare endpoint
    if (R2_CUSTOM_DOMAIN && R2_CUSTOM_DOMAIN !== 'your-custom-domain.com') {
      return `https://${R2_CUSTOM_DOMAIN}`;
    }
    return `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }

  /**
   * Get or create S3 client for R2
   */
  private static getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: this.getR2Endpoint(),
        credentials: {
          accessKeyId: R2_ACCESS_KEY,
          secretAccessKey: R2_SECRET_KEY,
        },
      });
    }
    return this.s3Client;
  }

  /**
   * Validate videos exist in R2 with retry logic
   * Uses direct S3 API calls instead of presigned URLs to avoid SSL issues
   */
  static async validateVideos(videoUrls: VideoUrls): Promise<ValidationResult> {
    try {
      const s3Client = this.getS3Client();
      const validationPromises = Object.entries(videoUrls)
        .filter(([_, url]) => url) // Filter out undefined URLs
        .map(async ([angle, url]) => {
          if (!url) return null;
          
          const key = this.extractKeyFromUrl(url);
          const metadata = await this.getVideoMetadata(s3Client, key);
          
          return {
            angle,
            metadata,
            valid: metadata.exists
          };
        });

      const results = await Promise.all(validationPromises);
      const validResults = results.filter(r => r !== null);
      const invalidVideos = validResults.filter(r => !r.valid);
      
      if (invalidVideos.length > 0) {
        return {
          valid: false,
          error: `Videos not found: ${invalidVideos.map(v => v.angle).join(', ')}`
        };
      }

      // Calculate total size
      const videoSizes: Record<string, number> = {};
      let totalBytes = 0;
      
      for (const result of validResults) {
        if (result && result.metadata.exists) {
          videoSizes[result.angle] = result.metadata.size;
          totalBytes += result.metadata.size;
        }
      }

      return {
        valid: true,
        videoSizes,
        totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100
      };

    } catch (error) {
      console.error('R2 validation failed:', error);
      return {
        valid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate videos exist after upload using object keys directly
   * This avoids the SSL handshake issues with presigned URLs
   */
  static async validateUploadedVideos(objectKeys: string[]): Promise<ValidationResult> {
    try {
      const s3Client = this.getS3Client();
      const validationPromises = objectKeys.map(async (key) => {
        const metadata = await this.getVideoMetadata(s3Client, key);
        return {
          key,
          metadata,
          valid: metadata.exists
        };
      });

      const results = await Promise.all(validationPromises);
      const invalidVideos = results.filter(r => !r.valid);
      
      if (invalidVideos.length > 0) {
        return {
          valid: false,
          error: `Videos not found: ${invalidVideos.map(v => v.key).join(', ')}`
        };
      }

      // Calculate total size
      const videoSizes: Record<string, number> = {};
      let totalBytes = 0;
      
      for (const result of results) {
        if (result.metadata.exists) {
          videoSizes[result.key] = result.metadata.size;
          totalBytes += result.metadata.size;
        }
      }

      return {
        valid: true,
        videoSizes,
        totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100
      };

    } catch (error) {
      console.error('R2 validation failed:', error);
      return {
        valid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate streaming URLs for pose analysis service
   * Uses signed GET URLs instead of base64 encoding (3x bandwidth reduction)
   */
  static async generateStreamingUrls(
    videoUrls: VideoUrls,
    expiresInSeconds = 900 // 15 minutes
  ): Promise<StreamingUrls> {
    try {
      const s3Client = this.getS3Client();
      const signedUrls: Record<string, string> = {};
      const requestId = crypto.randomUUID();

      for (const [angle, url] of Object.entries(videoUrls)) {
        if (!url) continue;
        
        const key = this.extractKeyFromUrl(url);
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key
        });

        const signedUrl = await getSignedUrl(s3Client, command, { 
          expiresIn: expiresInSeconds 
        });
        
        signedUrls[angle] = signedUrl;
      }

      const expiresAt = new Date(Date.now() + (expiresInSeconds * 1000));

      return {
        video_urls: signedUrls,
        expires_at: expiresAt.toISOString(),
        request_id: requestId
      };

    } catch (error) {
      console.error('Failed to generate streaming URLs:', error);
      throw new Error(`Failed to generate streaming URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get video metadata with retry logic
   */
  private static async getVideoMetadata(
    s3Client: S3Client, 
    key: string,
    maxRetries = 3
  ): Promise<VideoMetadata> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const command = new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key
        });

        const response = await s3Client.send(command);

        return {
          key,
          size: response.ContentLength || 0,
          lastModified: response.LastModified || new Date(),
          contentType: response.ContentType || 'video/webm',
          exists: true
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
          // File doesn't exist, no point retrying
          return {
            key,
            size: 0,
            lastModified: new Date(),
            contentType: '',
            exists: false
          };
        }

        if (attempt < maxRetries) {
          // Exponential backoff: 2^attempt seconds
          const waitTime = Math.pow(2, attempt) * 1000;
          console.warn(`R2 validation attempt ${attempt} failed for ${key}, retrying in ${waitTime}ms...`);
          await this.sleep(waitTime);
        }
      }
    }

    // All retries failed
    console.error(`R2 validation failed for ${key} after ${maxRetries} attempts:`, lastError);
    return {
      key,
      size: 0,
      lastModified: new Date(),
      contentType: '',
      exists: false
    };
  }

  /**
   * Extract R2 object key from presigned URL
   */
  static extractKeyFromUrl(presignedUrl: string): string {
    try {
      const url = new URL(presignedUrl);
      return url.pathname.substring(1); // Remove leading slash
    } catch (error) {
      console.error('Failed to extract key from URL:', presignedUrl, error);
      throw new Error(`Invalid URL format: ${presignedUrl}`);
    }
  }

  /**
   * Validate individual video file constraints
   */
  static validateVideoConstraints(
    fileSizeMB: number,
    contentType: string,
    maxSizeMB = 200
  ): { valid: boolean; error?: string } {
    if (fileSizeMB > maxSizeMB) {
      return {
        valid: false,
        error: `File too large: ${fileSizeMB}MB (max ${maxSizeMB}MB)`
      };
    }

    const allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(contentType)) {
      return {
        valid: false,
        error: `Invalid format: ${contentType}. Allowed: ${allowedTypes.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Check R2 service health
   * Uses ListObjectsV2 instead of presigned URLs to avoid SSL issues
   */
  static async healthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const s3Client = this.getS3Client();
      
      // Use ListObjects instead of HEAD to test connectivity
      // This avoids SSL handshake issues with presigned URLs
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        MaxKeys: 1 // Just check if we can connect
      });

      await s3Client.send(command);
      
      const latencyMs = Date.now() - startTime;
      return { healthy: true, latencyMs };

    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Utility sleep function
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate public URLs for video playback (avoids SSL handshake issues)
   * For production, consider setting up custom domain with R2
   */
  static generatePublicUrls(videoUrls: VideoUrls): VideoUrls {
    const publicUrls: VideoUrls = {};
    
    for (const [angle, presignedUrl] of Object.entries(videoUrls)) {
      if (!presignedUrl) continue;
      
      try {
        const url = new URL(presignedUrl);
        // Extract the object key (path without leading slash)
        const objectKey = url.pathname.substring(1);
        
        // Create public URL using the object key
        // Note: This assumes bucket has public read access or you have a custom domain
        publicUrls[angle] = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`;
      } catch (error) {
        console.warn(`Failed to generate public URL for ${angle}:`, error);
        // Fallback to original URL
        publicUrls[angle] = presignedUrl;
      }
    }
    
    return publicUrls;
  }

  /**
   * Get estimated bandwidth savings from streaming URLs vs base64
   */
  static getBandwidthSavings(totalSizeMB: number): {
    base64SizeMB: number;
    streamingSizeMB: number;
    savingsPercent: number;
    savedMB: number;
  } {
    const base64SizeMB = totalSizeMB * 1.33; // Base64 adds ~33% overhead
    const streamingSizeMB = 0.001; // Just the URL, ~1KB
    const savedMB = base64SizeMB - streamingSizeMB;
    const savingsPercent = Math.round((savedMB / base64SizeMB) * 100);

    return {
      base64SizeMB: Math.round(base64SizeMB * 100) / 100,
      streamingSizeMB,
      savingsPercent,
      savedMB: Math.round(savedMB * 100) / 100
    };
  }
} 