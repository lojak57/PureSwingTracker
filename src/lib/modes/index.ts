/**
 * Mode orchestration system - handles Training vs Quick Fix workflows
 */

import type {
  SwingMode,
  SwingSubmission,
  ProcessingResult,
  ModeConfig,
  ModeValidationRules,
  VideoFile,
  SwingMetadata
} from './types';

import {
  MODE_CONFIGS,
  MODE_CAPABILITIES,
  MODE_VALIDATION,
  MODE_DISPLAY
} from './types';

import { getCaddyAdvice } from '$lib/caddy';
import type { CaddyRequest } from '$lib/caddy/types';

export class ModeOrchestrator {
  
  /**
   * Validate submission based on mode requirements
   */
  static validateSubmission(submission: SwingSubmission): { valid: boolean; errors: string[] } {
    const config = MODE_CONFIGS[submission.mode];
    const validation = MODE_VALIDATION[submission.mode];
    const errors: string[] = [];
    
    // Check video count
    if (submission.videos.length < validation.required_video_count) {
      errors.push(`${submission.mode} mode requires ${validation.required_video_count} video(s)`);
    }
    
    // Check video requirements
    for (const video of submission.videos) {
      // File size validation
      if (video.file.size > config.max_file_size_mb * 1024 * 1024) {
        errors.push(`Video file too large. Max ${config.max_file_size_mb}MB for ${submission.mode} mode`);
      }
      
      // Duration validation (if available)
      if (video.duration_seconds) {
        if (video.duration_seconds < validation.min_video_duration) {
          errors.push(`Video too short. Min ${validation.min_video_duration}s required`);
        }
        if (video.duration_seconds > validation.max_video_duration) {
          errors.push(`Video too long. Max ${validation.max_video_duration}s allowed`);
        }
      }
      
      // Format validation
      const fileType = video.file.type.split('/')[1] || '';
      if (!validation.allowed_formats.includes(fileType)) {
        errors.push(`Unsupported format: ${fileType}. Allowed: ${validation.allowed_formats.join(', ')}`);
      }
    }
    
    // Training mode specific validations
    if (submission.mode === 'training') {
      const requiredAngles = ['down_line', 'face_on', 'overhead'];
      const providedAngles = submission.videos.map(v => v.angle).filter(Boolean);
      
      for (const required of requiredAngles) {
        if (!providedAngles.includes(required as any)) {
          errors.push(`Training mode requires ${required} angle video`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Process swing submission based on mode
   */
  static async processSwing(submission: SwingSubmission): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    try {
      // Validate submission
      const validation = this.validateSubmission(submission);
      if (!validation.valid) {
        return {
          swing_id: 'invalid',
          mode: submission.mode,
          processing_time_ms: performance.now() - startTime,
          analysis: {
            flaws: [],
            swing_score: 0,
            confidence: 0
          },
          errors: validation.errors.map(msg => ({
            code: 'VALIDATION_ERROR',
            message: msg,
            recoverable: true
          }))
        };
      }

      // Upload videos and create swing record
      const swingId = await this.uploadVideosAndCreateSwing(submission);
      
      // Process based on mode
      const analysis = submission.mode === 'training' 
        ? await this.processTrainingMode(swingId, submission)
        : await this.processQuickMode(swingId, submission);
      
      // Get caddy advice if location data available
      let caddyAdvice;
      if (submission.metadata.location && MODE_CAPABILITIES[submission.mode].personalization) {
        caddyAdvice = await this.getCaddyAdviceForShot(submission);
      }
      
      const processingTime = performance.now() - startTime;
      
      return {
        swing_id: swingId,
        mode: submission.mode,
        processing_time_ms: Math.round(processingTime),
        analysis,
        caddy_advice: caddyAdvice,
        errors: []
      };
      
    } catch (error) {
      console.error('Swing processing error:', error);
      return {
        swing_id: 'error',
        mode: submission.mode,
        processing_time_ms: performance.now() - startTime,
        analysis: {
          flaws: [],
          swing_score: 0,
          confidence: 0
        },
        errors: [{
          code: 'PROCESSING_ERROR',
          message: 'Unable to process swing at this time',
          recoverable: true
        }]
      };
    }
  }

  /**
   * Get presigned upload URLs based on mode
   */
  static async getUploadUrls(mode: SwingMode, userId: string): Promise<{ urls: Record<string, string>; swing_id: string }> {
    const config = MODE_CONFIGS[mode];
    const swingId = `swing_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // For now, return mock URLs - in production these would be R2 presigned URLs
    const urls: Record<string, string> = {};
    
    if (mode === 'training') {
      urls.down_line = `https://r2-bucket/swings/${swingId}/down_line.mp4`;
      urls.face_on = `https://r2-bucket/swings/${swingId}/face_on.mp4`;
      urls.overhead = `https://r2-bucket/swings/${swingId}/overhead.mp4`;
    } else {
      urls.single = `https://r2-bucket/swings/${swingId}/quick.mp4`;
    }
    
    return { urls, swing_id: swingId };
  }

  /**
   * Get mode configuration and display info
   */
  static getModeInfo(mode: SwingMode) {
    return {
      config: MODE_CONFIGS[mode],
      capabilities: MODE_CAPABILITIES[mode],
      validation: MODE_VALIDATION[mode],
      display: MODE_DISPLAY[mode]
    };
  }

  /**
   * Get recommended mode based on context
   */
  static getRecommendedMode(context: {
    location?: 'course' | 'range' | 'home';
    hasTriPod?: boolean;
    timeAvailable?: 'quick' | 'normal' | 'extended';
    purpose?: 'practice' | 'lesson' | 'round' | 'social';
  }): SwingMode {
    
    // On-course or social situations favor quick mode
    if (context.location === 'course' || context.purpose === 'round' || context.purpose === 'social') {
      return 'quick';
    }
    
    // Range with tripod and time favors training
    if (context.location === 'range' && context.hasTriPod && context.timeAvailable !== 'quick') {
      return 'training';
    }
    
    // Lessons always use training mode
    if (context.purpose === 'lesson') {
      return 'training';
    }
    
    // Default to quick for convenience
    return 'quick';
  }

  // Private helper methods

  private static async uploadVideosAndCreateSwing(submission: SwingSubmission): Promise<string> {
    // In production, this would:
    // 1. Upload videos to R2
    // 2. Create swing record in Supabase
    // 3. Return the swing ID
    
    const swingId = `swing_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Mock implementation
    console.log('Creating swing record:', {
      id: swingId,
      user_id: submission.user_id,
      mode: submission.mode,
      category: submission.metadata.category,
      video_count: submission.videos.length
    });
    
    return swingId;
  }

  private static async processTrainingMode(swingId: string, submission: SwingSubmission) {
    // Full 3-angle analysis with pose detection
    // In production, this would call the pose analysis service
    
    return {
      flaws: [
        {
          code: 'over_the_top',
          name: 'Over the Top',
          severity: 3 as const,
          description: 'Club coming over the plane in downswing',
          frame_references: [45, 52, 58]
        }
      ],
      swing_score: 72,
      confidence: 0.85,
      category_detected: submission.metadata.category,
      pose_data: { mock: 'pose_data' }
    };
  }

  private static async processQuickMode(swingId: string, submission: SwingSubmission) {
    // Quick single-angle analysis
    // Faster, less detailed processing
    
    return {
      flaws: [
        {
          code: 'tempo_fast',
          name: 'Fast Tempo',
          severity: 2 as const,
          description: 'Swing tempo appears rushed',
          frame_references: []
        }
      ],
      swing_score: 68,
      confidence: 0.65,
      category_detected: submission.metadata.category || 'iron'
    };
  }

  private static async getCaddyAdviceForShot(submission: SwingSubmission) {
    if (!submission.metadata.location) return undefined;
    
    const caddyRequest: CaddyRequest = {
      shot_context: {
        distance_to_target: 150, // Would get from GPS/course data
        lie_type: (submission.metadata.location.lie_type as any) || 'fairway'
      },
      mode: submission.mode,
      course_context: submission.metadata.location.hole_number ? {
        course_id: submission.metadata.location.course_name || '',
        hole_number: submission.metadata.location.hole_number,
        par: 4, // Would get from course data
        handicap: 10, // Would get from course data
        yardage: 400 // Would get from course data
      } : undefined
    };
    
    const advice = await getCaddyAdvice(caddyRequest);
    
    if ('code' in advice) return undefined;
    
    return {
      club_recommendation: advice.advice.recommendation.primary_club,
      strategy_note: advice.advice.recommendation.reasoning,
      confidence: advice.advice.recommendation.confidence,
      reasoning: advice.advice.personal_note || advice.advice.recommendation.reasoning
    };
  }
}

// Export convenience functions
export const validateSwingSubmission = ModeOrchestrator.validateSubmission;
export const processSwingSubmission = ModeOrchestrator.processSwing;
export const getUploadUrls = ModeOrchestrator.getUploadUrls;
export const getModeInfo = ModeOrchestrator.getModeInfo;
export const getRecommendedMode = ModeOrchestrator.getRecommendedMode;

// Export types for external use
export type { SwingMode, SwingSubmission, ProcessingResult } from './types'; 