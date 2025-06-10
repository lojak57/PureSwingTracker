/**
 * Unified Caddy API - orchestrates all caddy modules
 */

import type {
  CaddyRequest,
  CaddyResponse,
  CaddyAdvice,
  ShotAnalysis,
  PersonalTendencies,
  StrokesSavedData,
  CaddyError,
  UserClubStats
} from './types';

import { RecommendationEngine } from './recommendations';
import { PersonalizationEngine, type HistoricalShot, type SwingFlaw } from './personalization';

export class CaddySystem {
  
  /**
   * Main entry point - get caddy advice for a shot
   */
  static async getAdvice(request: CaddyRequest): Promise<CaddyResponse | CaddyError> {
    const startTime = performance.now();
    
    try {
      // 1. Load user's personal tendencies (if available)
      const tendencies = await this.loadPersonalTendencies(request);
      
      // 2. Get club recommendation
      const recommendation = RecommendationEngine.recommend(
        request.shot_context,
        tendencies,
        request.weather_context
      );
      
      // 3. Generate analysis factors
      const analysisFactors = RecommendationEngine.getAnalysisFactors(
        request.shot_context,
        request.weather_context,
        tendencies
      );
      
      // 4. Calculate shot analysis
      const analysis: ShotAnalysis = {
        expected_strokes: this.calculateExpectedStrokes(request),
        recommended_strokes: this.calculateRecommendedStrokes(request, recommendation.confidence),
        difficulty_rating: this.calculateDifficulty(request),
        success_probability: recommendation.confidence,
        factors: analysisFactors
      };
      
      // 5. Create caddy advice
      const advice: CaddyAdvice = {
        recommendation,
        context_factors: this.getContextFactors(request, tendencies),
        risk_assessment: this.assessRisk(request, recommendation),
        alternative_strategy: this.getAlternativeStrategy(request),
        personal_note: tendencies ? this.getPersonalNote(request, tendencies) : undefined
      };
      
      const processingTime = performance.now() - startTime;
      
      return {
        advice,
        analysis,
        processing_time_ms: Math.round(processingTime),
        mode: request.mode,
        personalization_applied: !!tendencies
      };
      
    } catch (error) {
      console.error('Caddy advice error:', error);
      return {
        code: 'PROCESSING_ERROR',
        message: 'Unable to generate advice at this time',
        suggestion: 'Please try again in a moment'
      };
    }
  }

  /**
   * Update user's personal tendencies (called after shots/swings)
   */
  static async updatePersonalization(
    userId: string,
    shots: HistoricalShot[],
    flaws: SwingFlaw[]
  ): Promise<PersonalTendencies> {
    
    // Calculate new tendencies
    const tendencies = PersonalizationEngine.calculateTendencies(shots, flaws);
    
    // Store in database (implementation depends on your DB layer)
    await this.savePersonalTendencies(userId, tendencies);
    
    return tendencies;
  }

  /**
   * Quick mode advice - faster, less detailed
   */
  static async getQuickAdvice(
    distance: number,
    lieType: string,
    userId?: string
  ): Promise<{ club: string; reasoning: string; confidence: number }> {
    
    const request: CaddyRequest = {
      shot_context: {
        distance_to_target: distance,
        lie_type: lieType as any
      },
      mode: 'quick'
    };
    
    const response = await this.getAdvice(request);
    
    if ('code' in response) {
      // Return basic recommendation on error
      return {
        club: distance > 150 ? '7-Iron' : '9-Iron',
        reasoning: 'Standard distance recommendation',
        confidence: 0.5
      };
    }
    
    return {
      club: response.advice.recommendation.primary_club,
      reasoning: response.advice.recommendation.reasoning,
      confidence: response.advice.recommendation.confidence
    };
  }

  /**
   * Calculate strokes saved from following advice
   */
  static calculateStrokesSaved(
    expected: number,
    actual: number,
    adviceFollowed: boolean
  ): StrokesSavedData {
    
    const saved = adviceFollowed ? Math.max(0, expected - actual) : 0;
    
    return {
      hole_number: 0, // Set by caller
      expected_strokes: expected,
      actual_strokes: actual,
      saved_strokes: saved,
      advice_followed: adviceFollowed,
      outcome: actual <= expected ? 'good' : 'poor'
    };
  }

  /**
   * Check if user needs caddy quota upgrade
   */
  static checkQuotaStatus(
    adviceCount: number,
    isPlusUser: boolean
  ): { canGetAdvice: boolean; quotaReached: boolean; savedStrokes?: number } {
    
    if (isPlusUser) {
      return { canGetAdvice: true, quotaReached: false };
    }
    
    const freeLimit = 3; // First 3 holes free
    const quotaReached = adviceCount >= freeLimit;
    
    return {
      canGetAdvice: !quotaReached,
      quotaReached,
      savedStrokes: adviceCount > 0 ? 2 : undefined // Placeholder - would calculate from actual data
    };
  }

  // Private helper methods

  private static async loadPersonalTendencies(request: CaddyRequest): Promise<PersonalTendencies | undefined> {
    // In a real implementation, this would load from database
    // For now, return undefined (no personalization)
    return undefined;
  }

  private static async savePersonalTendencies(userId: string, tendencies: PersonalTendencies): Promise<void> {
    // In a real implementation, this would save to database
    console.log('Saving tendencies for user:', userId, tendencies);
  }

  private static calculateExpectedStrokes(request: CaddyRequest): number {
    // USGA/course average for this situation
    const { shot_context, course_context } = request;
    
    // Simple heuristic - would use real course data in production
    if (shot_context.distance_to_target <= 100) return 2.5; // Short game
    if (shot_context.distance_to_target <= 150) return 2.8; // Mid iron
    if (shot_context.distance_to_target <= 200) return 3.1; // Long iron
    return 3.5; // Long shot
  }

  private static calculateRecommendedStrokes(request: CaddyRequest, confidence: number): number {
    const expected = this.calculateExpectedStrokes(request);
    const improvement = confidence * 0.3; // Max 0.3 stroke improvement with high confidence
    return Math.round((expected - improvement) * 10) / 10;
  }

  private static calculateDifficulty(request: CaddyRequest): number {
    let difficulty = 5; // Base difficulty
    
    const { shot_context, weather_context } = request;
    
    // Distance factor
    if (shot_context.distance_to_target > 180) difficulty += 1;
    if (shot_context.distance_to_target < 60) difficulty += 1;
    
    // Lie factor
    if (shot_context.lie_type === 'rough') difficulty += 2;
    if (shot_context.lie_type === 'sand') difficulty += 3;
    
    // Weather factor
    if (weather_context?.wind_speed && weather_context.wind_speed > 15) difficulty += 2;
    
    // Elevation factor
    if (shot_context.elevation_change && Math.abs(shot_context.elevation_change) > 20) difficulty += 1;
    
    return Math.min(difficulty, 10);
  }

  private static getContextFactors(request: CaddyRequest, tendencies?: PersonalTendencies): string[] {
    const factors: string[] = [];
    
    const { shot_context, weather_context } = request;
    
    // Distance
    factors.push(`${shot_context.distance_to_target}y to target`);
    
    // Lie
    if (shot_context.lie_type !== 'fairway') {
      factors.push(`${shot_context.lie_type} lie`);
    }
    
    // Weather
    if (weather_context?.wind_speed && weather_context.wind_speed > 10) {
      factors.push(`${weather_context.wind_speed}mph wind`);
    }
    
    // Personal
    if (tendencies && Object.keys(tendencies.club_bias).length > 0) {
      factors.push('personal tendencies applied');
    }
    
    return factors;
  }

  private static assessRisk(request: CaddyRequest, recommendation: any): 'low' | 'medium' | 'high' {
    const difficulty = this.calculateDifficulty(request);
    const confidence = recommendation.confidence;
    
    if (difficulty <= 4 && confidence >= 0.8) return 'low';
    if (difficulty <= 7 && confidence >= 0.6) return 'medium';
    return 'high';
  }

  private static getAlternativeStrategy(request: CaddyRequest): string | undefined {
    const { shot_context } = request;
    
    if (shot_context.lie_type === 'sand') {
      return 'Consider laying up to avoid the hazard';
    }
    
    if (shot_context.distance_to_target > 180) {
      return 'Play for center of green for safer approach';
    }
    
    return undefined;
  }

  private static getPersonalNote(request: CaddyRequest, tendencies: PersonalTendencies): string | undefined {
    const factors: string[] = [];
    
    if (tendencies.miss_pattern !== 'straight') {
      factors.push(`you tend to miss ${tendencies.miss_pattern}`);
    }
    
    if (tendencies.recurring_flaws.length > 0) {
      factors.push(`watch for ${tendencies.recurring_flaws[0]}`);
    }
    
    return factors.length > 0 ? factors.join(' and ') : undefined;
  }
}

// Export commonly used functions for convenience
export const getCaddyAdvice = CaddySystem.getAdvice;
export const getQuickAdvice = CaddySystem.getQuickAdvice;
export const updatePersonalization = CaddySystem.updatePersonalization;
export const checkQuotaStatus = CaddySystem.checkQuotaStatus;

// Export types for external use
export type {
  CaddyRequest,
  CaddyResponse,
  PersonalTendencies
} from './types';

export type {
  HistoricalShot,
  SwingFlaw
} from './personalization';

export { PersonalizationEngine } from './personalization'; 