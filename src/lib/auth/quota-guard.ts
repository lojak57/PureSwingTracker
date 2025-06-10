/**
 * Quota Guard Service
 * Enforces upload limits and processing constraints based on user plans
 * Prevents system overload and enables tiered pricing
 */

import { supabase } from '$lib/supabase';
import type { SwingMode } from '$lib/storage/r2-organizer';

export type UserPlan = 'starter' | 'pro' | 'premium';

export interface QuotaLimits {
  daily_uploads: number;
  concurrent_processing: number;
  monthly_storage_gb: number;
  features: {
    training_mode: boolean;
    real_time_feedback: boolean;
    advanced_analytics: boolean;
  };
}

export interface QuotaCheck {
  allowed: boolean;
  reason?: string;
  remaining?: {
    daily_uploads: number;
    concurrent_processing: number;
  };
  upgrade_suggestion?: {
    plan: UserPlan;
    benefit: string;
  };
}

export interface QuotaUsage {
  daily_uploads: number;
  concurrent_processing: number;
  monthly_storage_mb: number;
}

export class QuotaGuard {
  // Production quota limits
  private static readonly QUOTA_LIMITS: Record<UserPlan, QuotaLimits> = {
    starter: {
      daily_uploads: 3,
      concurrent_processing: 1,
      monthly_storage_gb: 1,
      features: {
        training_mode: false,
        real_time_feedback: true,
        advanced_analytics: false
      }
    },
    pro: {
      daily_uploads: 25,
      concurrent_processing: 3,
      monthly_storage_gb: 10,
      features: {
        training_mode: true,
        real_time_feedback: true,
        advanced_analytics: true
      }
    },
    premium: {
      daily_uploads: 100,
      concurrent_processing: 5,
      monthly_storage_gb: 50,
      features: {
        training_mode: true,
        real_time_feedback: true,
        advanced_analytics: true
      }
    }
  };

  /**
   * Check if user can upload based on quotas
   */
  static async checkUploadQuota(
    userId: string, 
    userPlan: UserPlan,
    mode: SwingMode
  ): Promise<QuotaCheck> {
    try {
      const limits = this.QUOTA_LIMITS[userPlan];
      if (!limits) {
        return { 
          allowed: false, 
          reason: 'Invalid plan type' 
        };
      }

      // Check if plan supports training mode
      if (mode === 'training' && !limits.features.training_mode) {
        return {
          allowed: false,
          reason: 'Training mode requires Pro or Premium plan',
          upgrade_suggestion: {
            plan: 'pro',
            benefit: 'Unlock 3-angle training mode with detailed pose analysis'
          }
        };
      }

      // Get current usage
      const usage = await this.getCurrentUsage(userId);

      // Check daily upload limit
      if (usage.daily_uploads >= limits.daily_uploads) {
        const nextTierLimits = this.getNextTierLimits(userPlan);
        return {
          allowed: false,
          reason: `Daily upload limit reached (${limits.daily_uploads})`,
          remaining: {
            daily_uploads: 0,
            concurrent_processing: Math.max(0, limits.concurrent_processing - usage.concurrent_processing)
          },
          upgrade_suggestion: nextTierLimits ? {
            plan: nextTierLimits.plan,
            benefit: `Increase daily uploads to ${nextTierLimits.limits.daily_uploads}`
          } : undefined
        };
      }

      // Check concurrent processing limit
      if (usage.concurrent_processing >= limits.concurrent_processing) {
        return {
          allowed: false,
          reason: `Too many swings processing (max ${limits.concurrent_processing})`,
          remaining: {
            daily_uploads: limits.daily_uploads - usage.daily_uploads,
            concurrent_processing: 0
          }
        };
      }

      // Check monthly storage limit (convert MB to GB)
      const monthlyStorageGB = usage.monthly_storage_mb / 1024;
      if (monthlyStorageGB >= limits.monthly_storage_gb) {
        return {
          allowed: false,
          reason: `Monthly storage limit reached (${limits.monthly_storage_gb}GB)`,
          upgrade_suggestion: {
            plan: userPlan === 'starter' ? 'pro' : 'premium',
            benefit: 'Increase storage capacity'
          }
        };
      }

      // All checks passed
      return {
        allowed: true,
        remaining: {
          daily_uploads: limits.daily_uploads - usage.daily_uploads,
          concurrent_processing: limits.concurrent_processing - usage.concurrent_processing
        }
      };

    } catch (error) {
      console.error('Quota check failed:', error);
      return {
        allowed: false,
        reason: 'Unable to verify quota limits'
      };
    }
  }

  /**
   * Get current user usage
   */
  private static async getCurrentUsage(userId: string): Promise<QuotaUsage> {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);

    try {
      // Get daily uploads
      const { count: dailyUploads } = await supabase
        .from('pure_swings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', today);

      // Get concurrent processing
      const { count: concurrentProcessing } = await supabase
        .from('pure_swings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['queued', 'processing']);

      // Estimate monthly storage usage (simplified)
      const { count: monthlySwings } = await supabase
        .from('pure_swings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString());

      // Rough estimate: 50MB per swing (3 angles × 15MB avg)
      const estimatedStorageMB = (monthlySwings || 0) * 50;

      return {
        daily_uploads: dailyUploads || 0,
        concurrent_processing: concurrentProcessing || 0,
        monthly_storage_mb: estimatedStorageMB
      };

    } catch (error) {
      console.error('Failed to get usage:', error);
      return {
        daily_uploads: 0,
        concurrent_processing: 0,
        monthly_storage_mb: 0
      };
    }
  }

  /**
   * Get next tier plan and benefits
   */
  private static getNextTierLimits(currentPlan: UserPlan): {
    plan: UserPlan;
    limits: QuotaLimits;
  } | null {
    switch (currentPlan) {
      case 'starter':
        return { plan: 'pro', limits: this.QUOTA_LIMITS.pro };
      case 'pro':
        return { plan: 'premium', limits: this.QUOTA_LIMITS.premium };
      case 'premium':
        return null; // Already top tier
    }
  }

  /**
   * Record quota usage for analytics
   */
  static async recordQuotaEvent(
    userId: string,
    eventType: 'upload_allowed' | 'upload_blocked' | 'processing_started',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await supabase
        .from('pure_quota_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          metadata: metadata || {},
          created_at: new Date().toISOString()
        });
    } catch (error) {
      // Non-critical, don't throw
      console.warn('Failed to record quota event:', error);
    }
  }

  /**
   * Get plan limits for display
   */
  static getPlanLimits(plan: UserPlan): QuotaLimits {
    return this.QUOTA_LIMITS[plan];
  }

  /**
   * Validate plan type
   */
  static isValidPlan(plan: string): plan is UserPlan {
    return ['starter', 'pro', 'premium'].includes(plan);
  }

  /**
   * Get estimated time to quota reset
   */
  static getTimeToReset(quotaType: 'daily' | 'monthly'): {
    hours: number;
    display: string;
  } {
    const now = new Date();
    
    if (quotaType === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const hoursToReset = (tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      return {
        hours: hoursToReset,
        display: hoursToReset < 1 
          ? `${Math.ceil(hoursToReset * 60)} minutes`
          : `${Math.ceil(hoursToReset)} hours`
      };
    } else {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const hoursToReset = (nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60);
      const daysToReset = Math.ceil(hoursToReset / 24);
      
      return {
        hours: hoursToReset,
        display: `${daysToReset} days`
      };
    }
  }
} 