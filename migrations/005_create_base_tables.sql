-- Base Tables Migration
-- Migration 005: Create essential tables for video processing

-- Create pure schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS pure;

-- Create users table in pure schema
CREATE TABLE IF NOT EXISTS pure.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(20) DEFAULT 'starter',
  handicap INTEGER,
  goals TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create base swings table
CREATE TABLE IF NOT EXISTS pure.swings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES pure.users(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'processing',
  video_urls JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  ai_flaws JSONB,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat_messages table for Coach Oliver
CREATE TABLE IF NOT EXISTS pure.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swing_id VARCHAR(50),  -- Can be 'general' or actual swing UUID
  user_id UUID REFERENCES pure.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_swings_user_id ON pure.swings(user_id);
CREATE INDEX IF NOT EXISTS idx_swings_created_at ON pure.swings(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON pure.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_swing_id ON pure.chat_messages(swing_id);

-- Enable RLS
ALTER TABLE pure.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.swings ENABLE ROW LEVEL SECURITY;  
ALTER TABLE pure.chat_messages ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "user owns their data" ON pure.users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "user owns their swings" ON pure.swings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user owns their chats" ON pure.chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- Insert test user for development
INSERT INTO pure.users (id, email, plan) 
VALUES (
  '00000000-0000-0000-0000-000000000000'::UUID,
  'test@example.com', 
  'pro'
) ON CONFLICT (email) DO UPDATE SET plan = EXCLUDED.plan;

COMMENT ON SCHEMA pure IS 'Pure Golf application schema';
COMMENT ON TABLE pure.users IS 'User accounts and plans';
COMMENT ON TABLE pure.swings IS 'Golf swing video submissions';
COMMENT ON TABLE pure.chat_messages IS 'Coach Oliver chat conversations'; 