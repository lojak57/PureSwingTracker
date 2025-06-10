/**
 * Club recommendation engine - core caddy logic
 */

import type {
  ClubRecommendation,
  ShotContext,
  PersonalTendencies,
  WeatherContext,
  UserClubStats,
  ClubData,
  AnalysisFactor
} from './types';
import { STANDARD_CLUBS, WEATHER_ADJUSTMENTS } from './types';

export class RecommendationEngine {
  
  /**
   * Generate club recommendation with personalization
   */
  static recommend(
    context: ShotContext,
    personalTendencies?: PersonalTendencies,
    weather?: WeatherContext,
    userStats?: UserClubStats[]
  ): ClubRecommendation {
    
    const startTime = performance.now();
    
    // 1. Calculate base distance with environmental factors
    const adjustedDistance = this.calculateAdjustedDistance(context, weather);
    
    // 2. Get base club recommendation
    const baseClub = this.getClubByDistance(adjustedDistance);
    
    // 3. Apply personal tendencies if available
    const personalizedRec = personalTendencies 
      ? this.applyPersonalization(baseClub, adjustedDistance, personalTendencies, context)
      : { club: baseClub.name, adjustment: 0, reasoning: 'Standard distance recommendation' };
    
    // 4. Consider alternative clubs
    const alternatives = this.getAlternativeClubs(personalizedRec.club, adjustedDistance, context);
    
    // 5. Calculate confidence based on data quality
    const confidence = this.calculateConfidence(personalTendencies, userStats, context);
    
    // 6. Generate aim and swing advice
    const { aimAdvice, swingThought } = this.generatePlayAdvice(
      personalizedRec.club, 
      context, 
      personalTendencies
    );
    
    return {
      primary_club: personalizedRec.club,
      alternative_clubs: alternatives,
      reasoning: personalizedRec.reasoning,
      confidence,
      distance_adjustment: personalizedRec.adjustment,
      aim_adjustment: aimAdvice,
      swing_thought: swingThought
    };
  }

  /**
   * Calculate distance adjustments for environmental factors
   */
  private static calculateAdjustedDistance(
    context: ShotContext, 
    weather?: WeatherContext
  ): number {
    let adjustedDistance = context.distance_to_target;
    
    // Wind adjustments
    if (weather?.wind_speed) {
      const windEffect = this.calculateWindEffect(weather.wind_speed, weather.wind_direction);
      adjustedDistance += windEffect;
    }
    
    // Temperature adjustments
    if (weather?.temperature) {
      const tempEffect = this.calculateTemperatureEffect(weather.temperature);
      adjustedDistance += tempEffect;
    }
    
    // Elevation adjustments
    if (context.elevation_change) {
      const elevationEffect = context.elevation_change * WEATHER_ADJUSTMENTS.elevation.uphill;
      adjustedDistance += elevationEffect;
    }
    
    // Lie type adjustments
    const lieAdjustment = this.getLieAdjustment(context.lie_type);
    adjustedDistance += lieAdjustment;
    
    return Math.round(adjustedDistance);
  }

  /**
   * Get base club by distance
   */
  private static getClubByDistance(distance: number): ClubData {
    // Find closest club by typical carry distance
    let bestClub = STANDARD_CLUBS[STANDARD_CLUBS.length - 2]; // Default to SW
    let smallestDiff = Infinity;
    
    for (const club of STANDARD_CLUBS) {
      if (club.type === 'putter') continue; // Skip putter for distance shots
      
      const diff = Math.abs(club.typical_carry - distance);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestClub = club;
      }
    }
    
    return bestClub;
  }

  /**
   * Apply personal tendencies to base recommendation
   */
  private static applyPersonalization(
    baseClub: ClubData,
    targetDistance: number,
    tendencies: PersonalTendencies,
    context: ShotContext
  ): { club: string; adjustment: number; reasoning: string } {
    
    const clubName = baseClub.name;
    const personalBias = tendencies.club_bias[clubName] || 0;
    
    // If bias is significant (>5 yards), consider club change
    if (Math.abs(personalBias) > 5) {
      const compensatedDistance = targetDistance - (personalBias * 0.8);
      const newClub = this.getClubByDistance(compensatedDistance);
      
      const biasDirection = personalBias > 0 ? 'long' : 'short';
      const reasoning = `Your ${clubName} typically plays ${Math.abs(personalBias)}y ${biasDirection}, so taking ${newClub.name} instead`;
      
      return {
        club: newClub.name,
        adjustment: personalBias,
        reasoning
      };
    }
    
    // Minor bias - keep same club but note it
    if (Math.abs(personalBias) > 2) {
      const direction = personalBias > 0 ? 'long' : 'short';
      const reasoning = `${clubName} (accounting for your ${Math.abs(personalBias)}y ${direction} tendency)`;
      
      return {
        club: clubName,
        adjustment: personalBias,
        reasoning
      };
    }
    
    // No significant bias
    return {
      club: clubName,
      adjustment: 0,
      reasoning: `${clubName} fits your typical distance`
    };
  }

  /**
   * Get alternative club options
   */
  private static getAlternativeClubs(
    primaryClub: string, 
    distance: number, 
    context: ShotContext
  ): string[] {
    const alternatives: string[] = [];
    const primary = STANDARD_CLUBS.find(c => c.name === primaryClub);
    
    if (!primary) return alternatives;
    
    // One club shorter (for pin-high or safe play)
    const shorterClub = STANDARD_CLUBS.find(c => 
      c.typical_carry < primary.typical_carry && 
      c.typical_carry >= primary.typical_carry - 15
    );
    if (shorterClub) alternatives.push(shorterClub.name);
    
    // One club longer (for aggressive play or into wind)
    const longerClub = STANDARD_CLUBS.find(c => 
      c.typical_carry > primary.typical_carry && 
      c.typical_carry <= primary.typical_carry + 15
    );
    if (longerClub) alternatives.push(longerClub.name);
    
    return alternatives;
  }

  /**
   * Calculate confidence in recommendation
   */
  private static calculateConfidence(
    tendencies?: PersonalTendencies,
    userStats?: UserClubStats[],
    context?: ShotContext
  ): number {
    let confidence = 0.7; // Base confidence
    
    // Boost confidence with personal data
    if (tendencies?.confidence_level) {
      confidence = Math.min(confidence + (tendencies.confidence_level * 0.3), 0.95);
    }
    
    // Reduce confidence for difficult conditions
    if (context?.lie_type === 'rough' || context?.lie_type === 'sand') {
      confidence *= 0.9;
    }
    
    // Reduce confidence for extreme distances
    if (context && (context.distance_to_target > 200 || context.distance_to_target < 50)) {
      confidence *= 0.85;
    }
    
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Generate aim and swing advice
   */
  private static generatePlayAdvice(
    club: string,
    context: ShotContext,
    tendencies?: PersonalTendencies
  ): { aimAdvice?: string; swingThought?: string } {
    
    const advice: { aimAdvice?: string; swingThought?: string } = {};
    
    // Aim adjustments based on miss pattern
    if (tendencies?.miss_pattern) {
      switch (tendencies.miss_pattern) {
        case 'right':
          advice.aimAdvice = 'aim slightly left';
          break;
        case 'left':
          advice.aimAdvice = 'aim slightly right';
          break;
        default:
          advice.aimAdvice = 'aim at target';
      }
    }
    
    // Swing thoughts based on lie and club
    if (context.lie_type === 'rough') {
      advice.swingThought = 'commit through the rough';
    } else if (context.lie_type === 'sand') {
      advice.swingThought = 'accelerate through impact';
    } else if (club.includes('Wood') || club === 'Driver') {
      advice.swingThought = 'smooth tempo';
    } else {
      advice.swingThought = 'trust your swing';
    }
    
    return advice;
  }

  /**
   * Calculate wind effect on ball flight
   */
  private static calculateWindEffect(windSpeed: number, windDirection?: string): number {
    if (!windDirection) return 0;
    
    const direction = windDirection.toLowerCase();
    
    if (direction.includes('head') || direction.includes('into')) {
      return windSpeed * WEATHER_ADJUSTMENTS.wind.headwind;
    } else if (direction.includes('tail') || direction.includes('helping')) {
      return windSpeed * WEATHER_ADJUSTMENTS.wind.tailwind;
    } else {
      // Cross wind - doesn't affect distance much but affects difficulty
      return 0;
    }
  }

  /**
   * Calculate temperature effect on ball flight
   */
  private static calculateTemperatureEffect(temperature: number): number {
    if (temperature < 70) {
      return (70 - temperature) * WEATHER_ADJUSTMENTS.temperature.cold;
    } else if (temperature > 80) {
      return (temperature - 80) * WEATHER_ADJUSTMENTS.temperature.hot;
    }
    return 0;
  }

  /**
   * Get distance adjustment for lie type
   */
  private static getLieAdjustment(lieType: string): number {
    const adjustments = {
      'tee': 0,
      'fairway': 0,
      'rough': -5,      // Harder to get clean contact
      'sand': -10,      // Much harder contact
      'greenside': 0,
      'green': 0
    };
    
    return adjustments[lieType as keyof typeof adjustments] || 0;
  }

  /**
   * Get analysis factors that influenced the recommendation
   */
  static getAnalysisFactors(
    context: ShotContext,
    weather?: WeatherContext,
    tendencies?: PersonalTendencies
  ): AnalysisFactor[] {
    const factors: AnalysisFactor[] = [];
    
    // Distance factor
    factors.push({
      type: 'distance',
      impact: context.distance_to_target > 180 ? 'negative' : 'neutral',
      description: `${context.distance_to_target}y to target`,
      weight: 1.0
    });
    
    // Lie factor
    if (context.lie_type !== 'fairway' && context.lie_type !== 'tee') {
      factors.push({
        type: 'lie',
        impact: 'negative',
        description: `${context.lie_type} lie reduces distance`,
        weight: 0.8
      });
    }
    
    // Weather factors
    if (weather?.wind_speed && weather.wind_speed > 10) {
      factors.push({
        type: 'weather',
        impact: weather.wind_direction?.includes('head') ? 'negative' : 'positive',
        description: `${weather.wind_speed}mph ${weather.wind_direction} wind`,
        weight: 0.6
      });
    }
    
    // Personal factors
    if (tendencies) {
      factors.push({
        type: 'personal',
        impact: 'positive',
        description: 'Personal tendencies applied',
        weight: 0.9
      });
    }
    
    return factors;
  }
} 