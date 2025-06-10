-- Pure Golf Platform Database Setup
-- Run this in Supabase SQL Editor
-- Uses 'pure' schema within existing TrueForm Supabase project

-- Create Pure schema and set permissions
CREATE SCHEMA IF NOT EXISTS pure;
GRANT USAGE ON SCHEMA pure TO authenticated;
GRANT CREATE ON SCHEMA pure TO authenticated;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users) - stays in public schema for shared access
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  handicap NUMERIC,
  goals JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Swings table (in pure schema)
CREATE TABLE IF NOT EXISTS pure.swings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('wood', 'iron', 'wedge', 'chip', 'putt')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  video_urls JSONB, -- { down_line, face_on, overhead }
  ai_pose JSONB,    -- MediaPipe keypoints
  ai_flaws JSONB,   -- Structured flaw analysis
  ai_summary TEXT,  -- GPT narrative feedback
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
  metadata JSONB DEFAULT '{}'
);

-- Drills table (in pure schema)
CREATE TABLE IF NOT EXISTS pure.drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  demo_url TEXT,
  target_flaws TEXT[] DEFAULT '{}', -- Flaw codes this drill addresses
  difficulty_level INTEGER DEFAULT 1, -- 1-5 difficulty scale
  estimated_duration_minutes INTEGER DEFAULT 10,
  equipment_needed TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Practice logs table (in pure schema)
CREATE TABLE IF NOT EXISTS pure.practice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drill_id UUID NOT NULL REFERENCES pure.drills(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5)
);

-- Chat messages table (in pure schema)
CREATE TABLE IF NOT EXISTS pure.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swing_id UUID NOT NULL REFERENCES pure.swings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.swings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.practice_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON users 
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users 
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can manage their own swings
CREATE POLICY "Users can view own swings" ON pure.swings 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own swings" ON pure.swings 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own swings" ON pure.swings 
  FOR UPDATE USING (auth.uid() = user_id);

-- All authenticated users can view drills
CREATE POLICY "Authenticated users can view drills" ON pure.drills 
  FOR SELECT TO authenticated;

-- Users can manage their own practice logs
CREATE POLICY "Users can view own practice logs" ON pure.practice_logs 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own practice logs" ON pure.practice_logs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own practice logs" ON pure.practice_logs 
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can manage their own chat messages
CREATE POLICY "Users can view own chat messages" ON pure.chat_messages 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat messages" ON pure.chat_messages 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_swings_user_id ON pure.swings(user_id);
CREATE INDEX IF NOT EXISTS idx_swings_category ON pure.swings(category);
CREATE INDEX IF NOT EXISTS idx_swings_created_at ON pure.swings(created_at);
CREATE INDEX IF NOT EXISTS idx_practice_logs_user_id ON pure.practice_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_logs_drill_id ON pure.practice_logs(drill_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_swing_id ON pure.chat_messages(swing_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on users table
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Seed data: Sample drills
INSERT INTO pure.drills (title, description, tags, target_flaws, difficulty_level, estimated_duration_minutes) VALUES
('Split Hand Takeaway', 'Practice your takeaway with hands separated on the grip to feel proper wrist hinge and club path.', ARRAY['takeaway', 'fundamentals'], ARRAY['over_the_top', 'steep_swing'], 2, 15),
('Slow Motion Transition', 'Practice the transition from backswing to downswing in slow motion to develop proper sequencing.', ARRAY['tempo', 'transition'], ARRAY['early_extension', 'casting'], 3, 20),
('Wall Drill for Spine Angle', 'Practice maintaining spine angle by keeping your back against a wall throughout the swing.', ARRAY['posture', 'spine'], ARRAY['early_extension', 'posture_loss'], 2, 10),
('Impact Bag Training', 'Use an impact bag to develop proper impact position and eliminate casting.', ARRAY['impact', 'hands'], ARRAY['casting', 'chicken_wing'], 3, 15),
('Feet Together Drill', 'Hit balls with feet together to improve balance and center your weight.', ARRAY['balance', 'fundamentals'], ARRAY['sway', 'loss_of_balance'], 2, 12);

-- Success message
SELECT 'Pure Golf Database Setup Complete! ��️‍♂️' as message; -- Migration: Add course tracking tables for Round Tracker + AI Caddy
-- Date: 2024-12-25
-- Part of: Pure Golf Platform - Round Tracker feature

-- Enable PostGIS extension for geography support
CREATE EXTENSION IF NOT EXISTS postgis;

-- Course Management Tables
CREATE TABLE IF NOT EXISTS pure.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id text UNIQUE NOT NULL, -- from external golf API
    name text NOT NULL,
    location geography(POINT, 4326), -- PostGIS geography type for lat/lng
    address jsonb,
    phone text,
    website text,
    tee_sets jsonb DEFAULT '[]'::jsonb, -- [{"name": "Blue", "rating": 72.1, "slope": 131}]
    last_updated timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pure.holes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid REFERENCES pure.courses(id) ON DELETE CASCADE,
    hole_number integer NOT NULL,
    par integer NOT NULL,
    handicap integer,
    yardages jsonb DEFAULT '{}'::jsonb, -- {"blue": 420, "white": 385, "red": 320}
    description text,
    gps_coordinates jsonb, -- {"tee": [lat,lng], "green": [lat,lng]}
    hazards jsonb DEFAULT '[]'::jsonb, -- bunkers, water, etc.
    created_at timestamptz DEFAULT now(),
    UNIQUE(course_id, hole_number)
);

-- Round Tracking Tables
CREATE TABLE IF NOT EXISTS pure.rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id uuid REFERENCES pure.courses(id),
    tee_set text NOT NULL, -- "Blue", "White", etc.
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    weather jsonb, -- temp, wind, conditions
    total_score integer,
    status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Shot Tracking
CREATE TABLE IF NOT EXISTS pure.shots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id uuid REFERENCES pure.rounds(id) ON DELETE CASCADE,
    hole_number integer NOT NULL,
    shot_number integer NOT NULL, -- 1st shot, 2nd shot, etc.
    distance_to_target integer, -- yards
    lie_type text, -- 'fairway', 'rough', 'sand', 'green', 'tree'
    lie_photo_url text,
    club_recommended text, -- from AI
    club_used text, -- actual club user selected
    shot_result text, -- 'green', 'fairway', 'rough', 'hazard', 'oob'
    distance_achieved integer, -- actual carry/roll
    accuracy_rating integer CHECK (accuracy_rating >= 1 AND accuracy_rating <= 10),
    gps_location geography(POINT, 4326),
    ai_confidence decimal(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    created_at timestamptz DEFAULT now()
);

-- User Club Performance (learns from shots + range sessions)
CREATE TABLE IF NOT EXISTS pure.user_club_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    club text NOT NULL, -- 'Driver', '7-Iron', 'PW', etc.
    avg_carry_yards decimal(5,1),
    avg_total_yards decimal(5,1),
    dispersion_yards decimal(4,1), -- left/right scatter
    accuracy_percentage decimal(4,1) CHECK (accuracy_percentage >= 0 AND accuracy_percentage <= 100),
    sample_size integer DEFAULT 0,
    last_updated timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, club)
);

-- Caddy Recommendations Log
CREATE TABLE IF NOT EXISTS pure.caddy_advice (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shot_id uuid REFERENCES pure.shots(id) ON DELETE CASCADE,
    recommended_club text NOT NULL,
    recommendation_reasoning text,
    alternative_clubs jsonb DEFAULT '[]'::jsonb, -- backup options
    confidence_score decimal(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    user_accepted boolean,
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_location ON pure.courses USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_courses_external_id ON pure.courses (external_id);
CREATE INDEX IF NOT EXISTS idx_courses_last_updated ON pure.courses (last_updated);

CREATE INDEX IF NOT EXISTS idx_holes_course_id ON pure.holes (course_id);
CREATE INDEX IF NOT EXISTS idx_holes_course_hole ON pure.holes (course_id, hole_number);

CREATE INDEX IF NOT EXISTS idx_rounds_user_id ON pure.rounds (user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_course_id ON pure.rounds (course_id);
CREATE INDEX IF NOT EXISTS idx_rounds_status ON pure.rounds (status);
CREATE INDEX IF NOT EXISTS idx_rounds_started_at ON pure.rounds (started_at);

CREATE INDEX IF NOT EXISTS idx_shots_round_id ON pure.shots (round_id);
CREATE INDEX IF NOT EXISTS idx_shots_round_hole ON pure.shots (round_id, hole_number);
CREATE INDEX IF NOT EXISTS idx_shots_lie_type ON pure.shots (lie_type);

CREATE INDEX IF NOT EXISTS idx_user_club_stats_user_id ON pure.user_club_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_user_club_stats_club ON pure.user_club_stats (user_id, club);

CREATE INDEX IF NOT EXISTS idx_caddy_advice_shot_id ON pure.caddy_advice (shot_id);

-- Row Level Security (RLS) Policies
ALTER TABLE pure.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.user_club_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.caddy_advice ENABLE ROW LEVEL SECURITY;

-- RLS Policies: courses and holes are public (readable by all authenticated users)
CREATE POLICY IF NOT EXISTS "courses_select_policy" ON pure.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "holes_select_policy" ON pure.holes FOR SELECT TO authenticated USING (true);

-- RLS Policies: rounds, shots, user_club_stats owned by user
CREATE POLICY IF NOT EXISTS "rounds_policy" ON pure.rounds 
    FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "shots_policy" ON pure.shots 
    FOR ALL TO authenticated USING (
        auth.uid() = (SELECT user_id FROM pure.rounds WHERE id = round_id)
    );

CREATE POLICY IF NOT EXISTS "user_club_stats_policy" ON pure.user_club_stats 
    FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "caddy_advice_policy" ON pure.caddy_advice 
    FOR ALL TO authenticated USING (
        auth.uid() = (
            SELECT r.user_id 
            FROM pure.rounds r 
            JOIN pure.shots s ON s.round_id = r.id 
            WHERE s.id = shot_id
        )
    );

-- Comments for documentation
COMMENT ON TABLE pure.courses IS 'Golf courses with location and metadata';
COMMENT ON TABLE pure.holes IS 'Individual holes with par, yardage, and layout data';
COMMENT ON TABLE pure.rounds IS 'Golf rounds being played by users';
COMMENT ON TABLE pure.shots IS 'Individual shots taken during rounds';
COMMENT ON TABLE pure.user_club_stats IS 'User-specific club performance statistics';
COMMENT ON TABLE pure.caddy_advice IS 'AI caddy recommendations for each shot';

COMMENT ON COLUMN pure.courses.location IS 'PostGIS geography point (lat, lng)';
COMMENT ON COLUMN pure.courses.external_id IS 'ID from external golf course API';
COMMENT ON COLUMN pure.holes.yardages IS 'Yardages by tee set: {"blue": 420, "white": 385}';
COMMENT ON COLUMN pure.shots.ai_confidence IS 'Confidence score for lie detection (0-1)';
COMMENT ON COLUMN pure.user_club_stats.dispersion_yards IS 'Average left/right miss distance';

-- Grant permissions
GRANT SELECT ON pure.courses TO authenticated;
GRANT SELECT ON pure.holes TO authenticated;
GRANT ALL ON pure.rounds TO authenticated;
GRANT ALL ON pure.shots TO authenticated;
GRANT ALL ON pure.user_club_stats TO authenticated;
GRANT ALL ON pure.caddy_advice TO authenticated; 