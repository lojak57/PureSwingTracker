import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Create Supabase client
export const supabase = createClient(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
);

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          handicap: number | null;
          goals: any | null; // JSON
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          handicap?: number | null;
          goals?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          handicap?: number | null;
          goals?: any | null;
          updated_at?: string;
        };
      };
      swings: {
        Row: {
          id: string;
          user_id: string;
          category: 'wood' | 'iron' | 'wedge' | 'chip' | 'putt';
          created_at: string;
          video_urls: any | null; // JSON: { down_line, face_on, overhead }
          ai_pose: any | null; // JSON: raw keypoints
          ai_flaws: any | null; // JSON: structured flaws
          ai_summary: string | null; // GPT narrative
        };
        Insert: {
          id?: string;
          user_id: string;
          category: 'wood' | 'iron' | 'wedge' | 'chip' | 'putt';
          created_at?: string;
          video_urls?: any | null;
          ai_pose?: any | null;
          ai_flaws?: any | null;
          ai_summary?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          category?: 'wood' | 'iron' | 'wedge' | 'chip' | 'putt';
          video_urls?: any | null;
          ai_pose?: any | null;
          ai_flaws?: any | null;
          ai_summary?: string | null;
        };
      };
      drills: {
        Row: {
          id: string;
          title: string;
          description: string;
          tags: string[];
          demo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          tags?: string[];
          demo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          tags?: string[];
          demo_url?: string | null;
        };
      };
      practice_logs: {
        Row: {
          id: string;
          user_id: string;
          drill_id: string;
          completed_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          drill_id: string;
          completed_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          drill_id?: string;
          completed_at?: string;
          notes?: string | null;
        };
      };
    };
  };
}

// Type helpers
export type SwingCategory = 'wood' | 'iron' | 'wedge' | 'chip' | 'putt';

export interface AIFlawsOutput {
  club_category: SwingCategory;
  primary_flaws: Array<{
    code: string;
    severity: number;
  }>;
  recommendations: string[];
  swing_score: number;
}

export interface VideoUrls {
  down_line: string;
  face_on: string;
  overhead: string;
} 