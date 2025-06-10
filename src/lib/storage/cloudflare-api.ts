/**
 * Cloudflare API Utility
 * Enables advanced R2 operations using Cloudflare API token
 */

import { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID } from '$env/static/private';

export class CloudflareAPI {
  private static readonly BASE_URL = 'https://api.cloudflare.com/client/v4';
  
  /**
   * Get R2 bucket CORS configuration
   */
  static async getBucketCORS(bucketName: string) {
    try {
      const response = await fetch(
        `${this.BASE_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucketName}/cors`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`CORS fetch failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get bucket CORS:', error);
      throw error;
    }
  }
  
  /**
   * Update R2 bucket CORS configuration
   */
  static async updateBucketCORS(bucketName: string, corsRules: any[]) {
    try {
      const response = await fetch(
        `${this.BASE_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucketName}/cors`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(corsRules),
        }
      );
      
      if (!response.ok) {
        throw new Error(`CORS update failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to update bucket CORS:', error);
      throw error;
    }
  }
  
  /**
   * Get R2 bucket lifecycle configuration
   */
  static async getBucketLifecycle(bucketName: string) {
    try {
      const response = await fetch(
        `${this.BASE_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucketName}/lifecycle`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Lifecycle fetch failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get bucket lifecycle:', error);
      throw error;
    }
  }
  
  /**
   * Test API token connectivity using token verification endpoint
   */
  static async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/user/tokens/verify`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        return {
          healthy: false,
          error: `API token verification failed: ${response.statusText}`
        };
      }
      
      const result = await response.json();
      
      return { 
        healthy: result.success === true,
        error: result.success ? undefined : result.errors?.join(', ')
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 