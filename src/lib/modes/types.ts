/**
 * Mode system types - Training vs Quick Fix
 */

export type SwingMode = 'training' | 'quick';

export interface ModeConfig {
  mode: SwingMode;
  video_requirements: VideoRequirement[];
  processing_time_target: number; // seconds
  analysis_depth: 'full' | 'basic';
  updates_user_stats: boolean;
  max_file_size_mb: number;
}

export interface VideoRequirement {
  angle: 'down_line' | 'face_on' | 'overhead' | 'any';
  required: boolean;
  description: string;
}

export interface ModeCapabilities {
  personalization: boolean;
  drill_recommendations: boolean;
  detailed_analysis: boolean;
  real_time_processing: boolean;
  chat_integration: boolean;
}

export interface SwingSubmission {
  mode: SwingMode;
  videos: VideoFile[];
  metadata: SwingMetadata;
  user_id: string;
}

export interface VideoFile {
  angle?: 'down_line' | 'face_on' | 'overhead';
  file: File | Blob;
  preview_url?: string;
  duration_seconds?: number;
}

export interface SwingMetadata {
  category?: 'wood' | 'iron' | 'wedge' | 'chip' | 'putt';
  club_used?: string;
  intended_target?: string;
  location?: {
    course_name?: string;
    hole_number?: number;
    lie_type?: string;
  };
  context?: {
    practice_session: boolean;
    on_course: boolean;
    lesson: boolean;
  };
}

export interface ProcessingResult {
  swing_id: string;
  mode: SwingMode;
  processing_time_ms: number;
  analysis: SwingAnalysis;
  recommendations?: DrillRecommendation[];
  caddy_advice?: CaddyAdvice;
  errors?: ProcessingError[];
}

export interface SwingAnalysis {
  pose_data?: any; // MediaPipe results
  flaws: FlawDetection[];
  swing_score: number;
  confidence: number;
  category_detected?: string;
}

export interface FlawDetection {
  code: string;
  name: string;
  severity: 1 | 2 | 3 | 4 | 5;
  description: string;
  frame_references?: number[];
}

export interface DrillRecommendation {
  drill_id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimated_improvement: string;
  video_url?: string;
}

export interface CaddyAdvice {
  club_recommendation?: string;
  strategy_note?: string;
  confidence: number;
  reasoning: string;
}

export interface ProcessingError {
  code: string;
  message: string;
  recoverable: boolean;
}

// Mode configurations
export const MODE_CONFIGS: Record<SwingMode, ModeConfig> = {
  training: {
    mode: 'training',
    video_requirements: [
      { angle: 'down_line', required: true, description: 'Side view - shows swing plane' },
      { angle: 'face_on', required: true, description: 'Front view - shows alignment' },
      { angle: 'overhead', required: true, description: 'Top view - shows club path' }
    ],
    processing_time_target: 20,
    analysis_depth: 'full',
    updates_user_stats: true,
    max_file_size_mb: 50
  },
  quick: {
    mode: 'quick',
    video_requirements: [
      { angle: 'any', required: true, description: 'Any angle - best available view' }
    ],
    processing_time_target: 10,
    analysis_depth: 'basic',
    updates_user_stats: false,
    max_file_size_mb: 25
  }
};

export const MODE_CAPABILITIES: Record<SwingMode, ModeCapabilities> = {
  training: {
    personalization: true,
    drill_recommendations: true,
    detailed_analysis: true,
    real_time_processing: false,
    chat_integration: true
  },
  quick: {
    personalization: true,
    drill_recommendations: false,
    detailed_analysis: false,
    real_time_processing: true,
    chat_integration: true
  }
};

// UI Display configurations
export interface ModeDisplayConfig {
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  use_case: string;
  processing_message: string;
  result_format: 'detailed' | 'summary';
}

export const MODE_DISPLAY: Record<SwingMode, ModeDisplayConfig> = {
  training: {
    name: 'Training Mode',
    subtitle: 'Deep analysis with 3 angles',
    icon: '🎯',
    color: 'blue',
    use_case: 'Range practice & improvement',
    processing_message: 'Analyzing your swing in detail...',
    result_format: 'detailed'
  },
  quick: {
    name: 'Quick Fix',
    subtitle: 'Fast advice from any angle',
    icon: '⚡',
    color: 'green',
    use_case: 'On-course & social golf',
    processing_message: 'Getting quick advice...',
    result_format: 'summary'
  }
};

// Validation rules
export interface ModeValidationRules {
  min_video_duration: number;
  max_video_duration: number;
  required_video_count: number;
  allowed_formats: string[];
  quality_requirements: {
    min_resolution: string;
    min_fps: number;
    stable_required: boolean;
  };
}

export const MODE_VALIDATION: Record<SwingMode, ModeValidationRules> = {
  training: {
    min_video_duration: 3,
    max_video_duration: 15,
    required_video_count: 3,
    allowed_formats: ['mp4', 'mov', 'webm'],
    quality_requirements: {
      min_resolution: '720p',
      min_fps: 30,
      stable_required: true
    }
  },
  quick: {
    min_video_duration: 2,
    max_video_duration: 10,
    required_video_count: 1,
    allowed_formats: ['mp4', 'mov', 'webm', 'quicktime'],
    quality_requirements: {
      min_resolution: '480p',
      min_fps: 24,
      stable_required: false
    }
  }
}; 