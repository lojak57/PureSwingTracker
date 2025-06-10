/**
 * R2 Key Organization Service
 * Handles structured key generation for Cloudflare R2 storage
 * Enables automated lifecycle management and cost optimization
 */

export type SwingMode = 'quick' | 'training';
export type VideoAngle = 'down_line' | 'face_on' | 'overhead' | 'single';

export interface R2KeyConfig {
  mode: SwingMode;
  userId: string;
  category: string;
  angle?: VideoAngle;
  uploadId?: string;
}

export interface R2LifecycleRule {
  id: string;
  status: 'Enabled' | 'Disabled';
  filter: { prefix: string };
  expiration?: { days: number };
  transitions?: Array<{ days: number; storageClass: string }>;
}

export class R2Organizer {
  /**
   * Generate structured R2 object key
   * Format: {mode}/{uploadId}/{angle}_{timestamp}.webm
   */
  static generateKey(config: R2KeyConfig): string {
    const uploadId = config.uploadId || crypto.randomUUID();
    const timestamp = Date.now();
    
    if (config.mode === 'quick') {
      // Quick mode: flat structure for easy cleanup
      // Format: quick/{uploadId}_{timestamp}.webm
      return `quick/${uploadId}_${timestamp}.webm`;
    } else {
      // Training mode: organized by upload session
      // Format: train/{uploadId}/{angle}_{category}_{timestamp}.webm
      const angle = config.angle || 'single';
      return `train/${uploadId}/${angle}_${config.category}_${timestamp}.webm`;
    }
  }

  /**
   * Extract metadata from R2 key
   */
  static parseKey(key: string): {
    mode: SwingMode;
    uploadId: string;
    angle?: VideoAngle;
    category?: string;
    timestamp?: number;
  } | null {
    try {
      // Quick mode pattern: quick/{uploadId}_{timestamp}.webm
      const quickMatch = key.match(/^quick\/([^_]+)_(\d+)\.webm$/);
      if (quickMatch) {
        return {
          mode: 'quick',
          uploadId: quickMatch[1],
          timestamp: parseInt(quickMatch[2])
        };
      }

      // Training mode pattern: train/{uploadId}/{angle}_{category}_{timestamp}.webm
      const trainingMatch = key.match(/^train\/([^\/]+)\/([^_]+)_([^_]+)_(\d+)\.webm$/);
      if (trainingMatch) {
        return {
          mode: 'training',
          uploadId: trainingMatch[1],
          angle: trainingMatch[2] as VideoAngle,
          category: trainingMatch[3],
          timestamp: parseInt(trainingMatch[4])
        };
      }

      return null;
    } catch (error) {
      console.warn('Failed to parse R2 key:', key, error);
      return null;
    }
  }

  /**
   * Generate lifecycle rules for R2 bucket
   * Quick mode: Delete after 30 days
   * Training mode: Archive after 90 days, delete after 1 year
   */
  static getLifecycleRules(): R2LifecycleRule[] {
    return [
      {
        id: 'quick-mode-cleanup',
        status: 'Enabled',
        filter: { prefix: 'quick/' },
        expiration: { days: 30 }
      },
      {
        id: 'training-mode-lifecycle', 
        status: 'Enabled',
        filter: { prefix: 'train/' },
        transitions: [
          { days: 90, storageClass: 'GLACIER' }
        ],
        expiration: { days: 365 }
      }
    ];
  }

  /**
   * Generate upload session ID for grouping related videos
   */
  static generateUploadSession(): string {
    return crypto.randomUUID();
  }

  /**
   * Get storage cost estimate based on mode and retention
   */
  static estimateStorageCost(mode: SwingMode, fileSizeMB: number): {
    monthly: number;
    lifetime: number;
  } {
    const baseRate = 0.015; // $0.015 per GB per month
    const sizeGB = fileSizeMB / 1024;
    const monthlyCost = sizeGB * baseRate;

    if (mode === 'quick') {
      // 30 days retention
      return {
        monthly: monthlyCost,
        lifetime: monthlyCost * (30 / 30) // 1 month
      };
    } else {
      // 90 days standard, then glacier for 275 days
      const standardCost = monthlyCost * (90 / 30); // 3 months
      const glacierCost = (monthlyCost * 0.1) * (275 / 30); // 90% cheaper
      
      return {
        monthly: monthlyCost,
        lifetime: standardCost + glacierCost
      };
    }
  }

  /**
   * Validate R2 key format
   */
  static isValidKey(key: string): boolean {
    return this.parseKey(key) !== null;
  }

  /**
   * Get folder prefix for mode
   */
  static getModePrefix(mode: SwingMode): string {
    return mode === 'quick' ? 'quick/' : 'train/';
  }
} 