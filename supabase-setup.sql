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
SELECT 'Pure Golf Database Setup Complete! ��️‍♂️' as message; 