/**
 * Caddy recommendation system type definitions
 */

export type ClubType = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';
export type LieType = 'tee' | 'fairway' | 'rough' | 'sand' | 'greenside' | 'green';
export type MissPattern = 'left' | 'right' | 'straight' | 'inconsistent';
export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'wind';

export interface ClubData {
  name: string;
  type: ClubType;
  loft: number;
  typical_carry: number;
  typical_total: number;
}

export interface PersonalTendencies {
  club_bias: Record<string, number>;        // { "7-iron": -8, "driver": +12 }
  miss_pattern: MissPattern;
  recurring_flaws: string[];               // ["early_extension", "over_the_top"]
  lie_preferences: Partial<Record<LieType, number>>; // success rate by lie type
  course_performance: Record<string, number>; // avg score by course
  confidence_level: number;                // 0-1, based on sample size
  last_updated: string;
}

export interface ShotContext {
  distance_to_target: number;
  lie_type: LieType;
  elevation_change?: number;  // positive = uphill
  wind_speed?: number;        // mph
  wind_direction?: string;    // relative to target
  temperature?: number;       // fahrenheit
  pin_position?: 'front' | 'middle' | 'back';
  hazards?: string[];         // ["water left", "bunker right"]
}

export interface ClubRecommendation {
  primary_club: string;
  alternative_clubs: string[];
  reasoning: string;
  confidence: number;         // 0-1
  distance_adjustment: number; // yards from base distance
  aim_adjustment?: string;    // "aim left", "aim center", etc.
  swing_thought?: string;     // "smooth tempo", "commit to it"
}

export interface CaddyAdvice {
  recommendation: ClubRecommendation;
  context_factors: string[];   // ["uphill lie", "into wind", "your 7i bias"]
  risk_assessment: 'low' | 'medium' | 'high';
  alternative_strategy?: string; // conservative option
  personal_note?: string;      // reference to their specific pattern
}

export interface UserClubStats {
  club: string;
  total_shots: number;
  avg_carry: number;
  avg_total: number;
  accuracy_percentage: number;
  miss_pattern: MissPattern;
  typical_lie_types: LieType[];
  last_10_distances: number[];
  bias_yards: number;          // calculated adjustment needed
}

export interface ShotAnalysis {
  expected_strokes: number;    // USGA/course average
  recommended_strokes: number; // with our advice
  difficulty_rating: number;   // 1-10
  success_probability: number; // 0-1
  factors: AnalysisFactor[];
}

export interface AnalysisFactor {
  type: 'distance' | 'lie' | 'weather' | 'personal' | 'course';
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  weight: number;              // how much it affects recommendation
}

export interface WeatherContext {
  temperature: number;
  wind_speed: number;
  wind_direction: string;
  humidity?: number;
  pressure?: number;
  conditions: WeatherCondition;
}

export interface CourseContext {
  course_id: string;
  hole_number: number;
  par: number;
  handicap: number;
  yardage: number;
  hole_description?: string;
  typical_strategy?: string;
}

export interface CaddyRequest {
  shot_context: ShotContext;
  weather_context?: WeatherContext;
  course_context?: CourseContext;
  user_preferences?: UserPreferences;
  mode: 'training' | 'quick';
}

export interface UserPreferences {
  preferred_clubs: string[];
  risk_tolerance: 'conservative' | 'aggressive' | 'balanced';
  coaching_style: 'technical' | 'simple' | 'encouraging';
  units: 'yards' | 'meters';
}

export interface CaddyResponse {
  advice: CaddyAdvice;
  analysis: ShotAnalysis;
  processing_time_ms: number;
  mode: 'training' | 'quick';
  personalization_applied: boolean;
}

export interface StrokesSavedData {
  hole_number: number;
  expected_strokes: number;
  actual_strokes?: number;
  saved_strokes?: number;
  advice_followed: boolean;
  outcome: string;
}

export interface CaddyError {
  code: 'INSUFFICIENT_DATA' | 'WEATHER_UNAVAILABLE' | 'PROCESSING_ERROR' | 'QUOTA_EXCEEDED';
  message: string;
  suggestion?: string;
}

// Golf club data constants
export const STANDARD_CLUBS: ClubData[] = [
  { name: 'Driver', type: 'driver', loft: 10.5, typical_carry: 250, typical_total: 275 },
  { name: '3-Wood', type: 'wood', loft: 15, typical_carry: 225, typical_total: 245 },
  { name: '5-Wood', type: 'wood', loft: 18, typical_carry: 210, typical_total: 230 },
  { name: '3-Hybrid', type: 'hybrid', loft: 21, typical_carry: 195, typical_total: 210 },
  { name: '4-Iron', type: 'iron', loft: 24, typical_carry: 180, typical_total: 195 },
  { name: '5-Iron', type: 'iron', loft: 27, typical_carry: 170, typical_total: 185 },
  { name: '6-Iron', type: 'iron', loft: 30, typical_carry: 160, typical_total: 175 },
  { name: '7-Iron', type: 'iron', loft: 34, typical_carry: 150, typical_total: 165 },
  { name: '8-Iron', type: 'iron', loft: 38, typical_carry: 140, typical_total: 150 },
  { name: '9-Iron', type: 'iron', loft: 42, typical_carry: 130, typical_total: 140 },
  { name: 'PW', type: 'wedge', loft: 46, typical_carry: 120, typical_total: 125 },
  { name: 'GW', type: 'wedge', loft: 50, typical_carry: 110, typical_total: 115 },
  { name: 'SW', type: 'wedge', loft: 56, typical_carry: 100, typical_total: 105 },
  { name: 'LW', type: 'wedge', loft: 60, typical_carry: 85, typical_total: 90 },
  { name: 'Putter', type: 'putter', loft: 4, typical_carry: 0, typical_total: 0 }
];

// Environmental impact factors
export const WEATHER_ADJUSTMENTS = {
  wind: {
    headwind: -1.5,    // yards per mph
    tailwind: 1.0,     // yards per mph
    crosswind: 0.5     // difficulty factor
  },
  temperature: {
    cold: -0.2,        // yards per degree below 70F
    hot: 0.1          // yards per degree above 80F
  },
  elevation: {
    uphill: -2,        // yards per degree of elevation
    downhill: 1.5      // yards per degree of elevation
  }
} as const; 