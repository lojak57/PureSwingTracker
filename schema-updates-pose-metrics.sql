-- Schema Updates for Pose Metrics Implementation
-- Execute in Supabase SQL Editor

-- 1. Add columns to pure_swings table
ALTER TABLE pure_swings
  ADD COLUMN swing_mode text DEFAULT 'quick' CHECK (swing_mode IN ('quick', 'range')),
  ADD COLUMN angle_id smallint DEFAULT 0,
  ADD COLUMN swing_session_id uuid; -- Links multiple angles together

-- 2. Create swing_metrics table with fixed precision
CREATE TABLE swing_metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swing_id    uuid REFERENCES pure_swings(id) ON DELETE CASCADE,
  tempo_ratio numeric(4,2),      -- Fixed precision for SQL aggregates
  plane_delta numeric(4,1),      -- degrees (positive = steep)
  hip_sway_cm numeric(4,1),
  x_factor    numeric(4,1),      -- null in quick mode
  video_hash  text,              -- sha256 for caching
  created_at  timestamptz DEFAULT now()
);

-- 3. RLS for swing_metrics
ALTER TABLE swing_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can view own metrics"
ON swing_metrics
FOR SELECT
USING (
  -- Use current_setting for Edge Functions compatibility
  COALESCE(
    current_setting('request.jwt.claim.sub', true)::uuid,
    auth.uid()
  ) = (SELECT user_id FROM pure_swings WHERE id = swing_id)
);

-- 4. Create analysis queue with error tracking
CREATE TABLE analysis_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swing_id uuid REFERENCES pure_swings(id) ON DELETE CASCADE,
  attempts smallint DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now()
);

-- 5. Advisory lock function to prevent double-processing
CREATE OR REPLACE FUNCTION process_next_analysis()
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  queue_item_id uuid;
BEGIN
  -- Try to acquire lock and get next item atomically
  SELECT id INTO queue_item_id
  FROM analysis_queue
  WHERE pg_try_advisory_xact_lock(hashtext(id::text))
  ORDER BY created_at
  LIMIT 1;
  
  RETURN queue_item_id;
END;
$$;

-- 6. Enhanced feature flags with expiry
CREATE TABLE features (
  key text PRIMARY KEY,
  enabled boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id), -- optional: per-user flags
  enabled_until timestamptz -- auto-expire testers
);

INSERT INTO features VALUES ('pose_metrics', false, null, null);

-- 7. Indexes for performance
CREATE INDEX idx_swings_session ON pure_swings(swing_session_id, angle_id);
CREATE INDEX idx_queue_created ON analysis_queue(created_at);
CREATE INDEX idx_metrics_swing ON swing_metrics(swing_id);

-- 8. Trigger to update swing status when metrics ready
CREATE OR REPLACE FUNCTION mark_metrics_ready()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pure_swings
    SET status = 'metrics_ready'
  WHERE id = NEW.swing_id;
  RETURN NEW;
END; 
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_metrics_ready
AFTER INSERT ON swing_metrics
FOR EACH ROW EXECUTE PROCEDURE mark_metrics_ready();

-- 9. Function to enqueue analysis jobs
CREATE OR REPLACE FUNCTION enqueue_analysis_job(p_swing_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER
AS $$
  INSERT INTO analysis_queue (swing_id) VALUES (p_swing_id);
$$; 