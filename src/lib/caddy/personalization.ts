/**
 * Personalization engine - calculates user tendencies from historical data
 */

import type {
  PersonalTendencies,
  UserClubStats,
  MissPattern,
  LieType
} from './types';

export interface HistoricalShot {
  club: string;
  intended_distance: number;
  actual_distance: number;
  lie_type: LieType;
  result: 'good' | 'short' | 'long' | 'left' | 'right' | 'poor';
  date: string;
}

export interface SwingFlaw {
  flaw_code: string;
  severity: number;
  frequency: number;
  date: string;
}

export class PersonalizationEngine {
  
  /**
   * Calculate personal tendencies from user's historical data
   */
  static calculateTendencies(
    shots: HistoricalShot[],
    flaws: SwingFlaw[],
    courseScores?: Record<string, number[]>
  ): PersonalTendencies {
    
    if (shots.length < 10) {
      return this.getDefaultTendencies();
    }
    
    return {
      club_bias: this.calculateClubBias(shots),
      miss_pattern: this.calculateMissPattern(shots),
      recurring_flaws: this.getRecurringFlaws(flaws),
      lie_preferences: this.calculateLiePreferences(shots),
      course_performance: this.calculateCoursePerformance(courseScores || {}),
      confidence_level: this.calculateConfidenceLevel(shots.length),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Calculate distance bias for each club
   */
  private static calculateClubBias(shots: HistoricalShot[]): Record<string, number> {
    const clubData: Record<string, { diffs: number[]; total: number }> = {};
    
    // Group shots by club and calculate distance differences
    for (const shot of shots) {
      if (!clubData[shot.club]) {
        clubData[shot.club] = { diffs: [], total: 0 };
      }
      
      const diff = shot.actual_distance - shot.intended_distance;
      clubData[shot.club].diffs.push(diff);
    }
    
    // Calculate average bias for each club
    const bias: Record<string, number> = {};
    for (const [club, data] of Object.entries(clubData)) {
      if (data.diffs.length >= 3) { // Need at least 3 shots for bias calculation
        const avgDiff = data.diffs.reduce((sum, diff) => sum + diff, 0) / data.diffs.length;
        
        // Only record significant bias (>2 yards)
        if (Math.abs(avgDiff) > 2) {
          bias[club] = Math.round(avgDiff);
        }
      }
    }
    
    return bias;
  }

  /**
   * Determine primary miss pattern
   */
  private static calculateMissPattern(shots: HistoricalShot[]): MissPattern {
    const missCount = {
      left: 0,
      right: 0,
      straight: 0,
      short: 0,
      long: 0
    };
    
    // Count directional misses (prioritize direction over distance)
    for (const shot of shots) {
      switch (shot.result) {
        case 'left':
          missCount.left++;
          break;
        case 'right':
          missCount.right++;
          break;
        case 'good':
          missCount.straight++;
          break;
        case 'short':
        case 'long':
          // These are distance misses, less important for aim advice
          break;
      }
    }
    
    // Find dominant pattern
    const total = missCount.left + missCount.right + missCount.straight;
    if (total < 5) return 'inconsistent';
    
    const leftPercentage = missCount.left / total;
    const rightPercentage = missCount.right / total;
    
    if (leftPercentage > 0.4) return 'left';
    if (rightPercentage > 0.4) return 'right';
    return 'straight';
  }

  /**
   * Get most recurring swing flaws
   */
  private static getRecurringFlaws(flaws: SwingFlaw[]): string[] {
    if (flaws.length === 0) return [];
    
    // Count frequency of each flaw in last 20 analyses
    const recentFlaws = flaws
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
    
    const flawCount: Record<string, number> = {};
    
    for (const flaw of recentFlaws) {
      if (flaw.severity >= 2) { // Only count significant flaws
        flawCount[flaw.flaw_code] = (flawCount[flaw.flaw_code] || 0) + 1;
      }
    }
    
    // Return top 3 most frequent flaws
    return Object.entries(flawCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .filter(([,count]) => count >= 2) // Must appear at least twice
      .map(([flaw]) => flaw);
  }

  /**
   * Calculate success rate by lie type
   */
  private static calculateLiePreferences(shots: HistoricalShot[]): Record<LieType, number> {
    const lieStats: Record<string, { good: number; total: number }> = {};
    
    for (const shot of shots) {
      if (!lieStats[shot.lie_type]) {
        lieStats[shot.lie_type] = { good: 0, total: 0 };
      }
      
      lieStats[shot.lie_type].total++;
      if (shot.result === 'good') {
        lieStats[shot.lie_type].good++;
      }
    }
    
    // Calculate success percentage for each lie type
    const preferences: Partial<Record<LieType, number>> = {};
    
    for (const [lie, stats] of Object.entries(lieStats)) {
      if (stats.total >= 3) { // Need minimum shots for meaningful percentage
        preferences[lie as LieType] = Math.round((stats.good / stats.total) * 100) / 100;
      }
    }
    
    return preferences;
  }

  /**
   * Calculate average performance by course
   */
  private static calculateCoursePerformance(courseScores: Record<string, number[]>): Record<string, number> {
    const performance: Record<string, number> = {};
    
    for (const [courseId, scores] of Object.entries(courseScores)) {
      if (scores.length > 0) {
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        performance[courseId] = Math.round(avgScore * 10) / 10;
      }
    }
    
    return performance;
  }

  /**
   * Calculate confidence level based on data quantity and recency
   */
  private static calculateConfidenceLevel(shotCount: number): number {
    // Confidence increases with more data, maxes at 100 shots
    let confidence = Math.min(shotCount / 100, 1.0);
    
    // Minimum confidence threshold
    if (shotCount < 20) {
      confidence *= 0.5;
    }
    
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Get default tendencies for new users
   */
  private static getDefaultTendencies(): PersonalTendencies {
    return {
      club_bias: {},
      miss_pattern: 'inconsistent',
      recurring_flaws: [],
      lie_preferences: {},
      course_performance: {},
      confidence_level: 0.1,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Update tendencies with new shot data (incremental update)
   */
  static updateTendencies(
    currentTendencies: PersonalTendencies,
    newShots: HistoricalShot[],
    newFlaws: SwingFlaw[]
  ): PersonalTendencies {
    
    // For now, recalculate everything
    // In production, this could be optimized for incremental updates
    const historicalShots = newShots; // Would normally merge with existing data
    const allFlaws = newFlaws; // Would normally merge with existing data
    
    return this.calculateTendencies(historicalShots, allFlaws);
  }

  /**
   * Check if tendencies need refresh (older than 7 days or <20 confidence)
   */
  static needsRefresh(tendencies: PersonalTendencies): boolean {
    const lastUpdate = new Date(tendencies.last_updated);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSinceUpdate > 7 || tendencies.confidence_level < 0.2;
  }

  /**
   * Generate personal reasoning text for recommendations
   */
  static generatePersonalReasoning(
    club: string,
    adjustment: number,
    tendencies: PersonalTendencies
  ): string {
    const reasons: string[] = [];
    
    // Club bias reasoning
    if (Math.abs(adjustment) > 2) {
      const direction = adjustment > 0 ? 'long' : 'short';
      reasons.push(`your ${club} typically plays ${Math.abs(adjustment)}y ${direction}`);
    }
    
    // Miss pattern reasoning
    if (tendencies.miss_pattern !== 'straight' && tendencies.miss_pattern !== 'inconsistent') {
      reasons.push(`you tend to miss ${tendencies.miss_pattern}`);
    }
    
    // Flaw-based reasoning
    if (tendencies.recurring_flaws.length > 0) {
      const primaryFlaw = tendencies.recurring_flaws[0];
      const flawDescriptions: Record<string, string> = {
        'over_the_top': 'to counter your over-the-top swing',
        'early_extension': 'given your tendency to stand up early',
        'slice': 'to help with your slice tendency',
        'hook': 'to prevent your hook pattern'
      };
      
      if (flawDescriptions[primaryFlaw]) {
        reasons.push(flawDescriptions[primaryFlaw]);
      }
    }
    
    return reasons.length > 0 
      ? reasons.join(' and ')
      : 'based on standard distances';
  }

  /**
   * Get confidence description for UI
   */
  static getConfidenceDescription(confidence: number): string {
    if (confidence >= 0.8) return 'High confidence';
    if (confidence >= 0.6) return 'Good confidence';
    if (confidence >= 0.4) return 'Moderate confidence';
    if (confidence >= 0.2) return 'Low confidence';
    return 'Building profile';
  }

  /**
   * Detect significant changes in user's game
   */
  static detectTrendChanges(
    oldTendencies: PersonalTendencies,
    newTendencies: PersonalTendencies
  ): string[] {
    const changes: string[] = [];
    
    // Check for miss pattern changes
    if (oldTendencies.miss_pattern !== newTendencies.miss_pattern) {
      changes.push(`Miss pattern changed from ${oldTendencies.miss_pattern} to ${newTendencies.miss_pattern}`);
    }
    
    // Check for significant club bias changes
    for (const [club, newBias] of Object.entries(newTendencies.club_bias)) {
      const oldBias = oldTendencies.club_bias[club] || 0;
      const biasDiff = Math.abs(newBias - oldBias);
      
      if (biasDiff > 5) {
        changes.push(`${club} bias changed by ${Math.round(biasDiff)}y`);
      }
    }
    
    return changes;
  }
} 