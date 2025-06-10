/**
 * Cloudflare API Utility
 * Enables advanced R2 operations using Cloudflare API token
 */

import { CLOUDFLARE_ACCOUNT_ID } from '$env/static/private';
import { env } from '$env/dynamic/private';

export class CloudflareAPI {
  private static readonly BASE_URL = 'https://api.cloudflare.com/client/v4';
  
  private static get apiToken() {
    return env.CLOUDFLARE_API_TOKEN || '';
  }
  
  private static checkToken() {
    if (!this.apiToken) {
      throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
    }
  }
  
  /**
   * Get R2 bucket CORS configuration
   */
  static async getBucketCORS(bucketName: string) {
    this.checkToken();
    try {
      const response = await fetch(
        `${this.BASE_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucketName}/cors`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
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
    this.checkToken();
    try {
      const response = await fetch(
        `${this.BASE_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucketName}/cors`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
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
    this.checkToken();
    try {
      const response = await fetch(
        `${this.BASE_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucketName}/lifecycle`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
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
      if (!this.apiToken) {
        return {
          healthy: false,
          error: 'CLOUDFLARE_API_TOKEN environment variable not set'
        };
      }
      
      const response = await fetch(
        `${this.BASE_URL}/user/tokens/verify`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
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