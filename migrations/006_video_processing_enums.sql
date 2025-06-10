-- Video Processing Schema Updates
-- Migration 006: Add enums and tables for production video processing

-- Create swing status enum
CREATE TYPE swing_status AS ENUM ('queued', 'processing', 'completed', 'failed');

-- Update existing swings table - handle default constraint
-- First drop any existing default
ALTER TABLE pure.swings ALTER COLUMN status DROP DEFAULT;

-- Then change the column type
ALTER TABLE pure.swings 
  ALTER COLUMN status TYPE swing_status 
  USING COALESCE(status::swing_status, 'queued'::swing_status);

-- Set new default value
ALTER TABLE pure.swings ALTER COLUMN status SET DEFAULT 'queued'::swing_status;

-- Add new columns for enhanced tracking
ALTER TABLE pure.swings ADD COLUMN IF NOT EXISTS upload_mode VARCHAR(20);
ALTER TABLE pure.swings ADD COLUMN IF NOT EXISTS estimated_tokens INTEGER;
ALTER TABLE pure.swings ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE pure.swings ADD COLUMN IF NOT EXISTS worker_id VARCHAR(50);
ALTER TABLE pure.swings ADD COLUMN IF NOT EXISTS r2_validated BOOLEAN DEFAULT false;

-- Create swing costs tracking table
CREATE TABLE IF NOT EXISTS pure.swing_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swing_id UUID REFERENCES pure.swings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES pure.users(id) ON DELETE CASCADE,
  tokens_used INTEGER NOT NULL,
  estimated_cost DECIMAL(8,4) NOT NULL,
  model_used VARCHAR(50) NOT NULL,
  provider VARCHAR(20) DEFAULT 'openai',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_swings_status_created ON pure.swings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_swings_user_status ON pure.swings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_swing_costs_user_date ON pure.swing_costs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_swings_processing ON pure.swings(status) WHERE status IN ('queued', 'processing');

-- RLS policies for new table
CREATE POLICY "user owns swing costs" ON pure.swing_costs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service can insert swing costs" ON pure.swing_costs
  FOR INSERT WITH CHECK (true);

-- Update existing RLS for swings table
DROP POLICY IF EXISTS "user owns swings" ON pure.swings;
CREATE POLICY "user owns swings" ON pure.swings
  FOR ALL USING (auth.uid() = user_id);

-- Allow service role to update swing status
CREATE POLICY "service can update swing status" ON pure.swings
  FOR UPDATE USING (true);

-- Create quota events tracking table
CREATE TABLE IF NOT EXISTS pure.quota_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES pure.users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quota_events_user_date ON pure.quota_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quota_events_type ON pure.quota_events(event_type);

-- RLS for quota events
CREATE POLICY "user owns quota events" ON pure.quota_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service can insert quota events" ON pure.quota_events
  FOR INSERT WITH CHECK (true);

COMMENT ON TYPE swing_status IS 'Enum for swing processing status to prevent typos';
COMMENT ON TABLE pure.swing_costs IS 'Tracks AI token usage and costs per swing for monitoring';
COMMENT ON TABLE pure.quota_events IS 'Tracks quota usage events for analytics and monitoring';
COMMENT ON INDEX idx_swings_processing IS 'Optimizes queue worker queries for pending swings'; 