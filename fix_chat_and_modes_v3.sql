-- Fix Chat & Add Mode Support - Complete Migration (v3)
-- Run this in Supabase SQL Editor to fix current issues

-- Enable PostGIS extension for geography support (for rounds/GPS)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Add mode support to existing swings table (if column doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'pure' AND table_name = 'swings' AND column_name = 'mode'
  ) THEN
    ALTER TABLE pure.swings ADD COLUMN mode text DEFAULT 'training' 
    CHECK (mode IN ('training', 'quick'));
    
    CREATE INDEX idx_swings_mode ON pure.swings(mode);
    CREATE INDEX idx_swings_user_mode ON pure.swings(user_id, mode);
  END IF;
END $$;

-- 2. Create profiles table if it doesn't exist (for personal tendencies)
CREATE TABLE IF NOT EXISTS pure.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text,
    handicap numeric,
    goals jsonb,
    personal_tendencies jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE pure.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON pure.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON pure.profiles;

CREATE POLICY "Users can view own profile" ON pure.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON pure.profiles
    FOR ALL USING (auth.uid() = id);

-- 3. Make sure chat_messages table handles 'general' swings
-- Update chat_messages to allow NULL swing_id for general chat
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'pure' AND table_name = 'chat_messages' AND column_name = 'swing_id'
  ) THEN
    -- Remove NOT NULL constraint if it exists
    ALTER TABLE pure.chat_messages ALTER COLUMN swing_id DROP NOT NULL;
  END IF;
END $$;

-- 4. Create a view that combines auth.users with profiles for easy querying
CREATE OR REPLACE VIEW pure.user_profiles AS
SELECT 
    u.id,
    u.email,
    COALESCE(p.name, u.raw_user_meta_data->>'name') as name,
    p.handicap,
    p.goals,
    p.personal_tendencies,
    p.created_at,
    p.updated_at
FROM auth.users u
LEFT JOIN pure.profiles p ON u.id = p.id;

-- Grant access to the view
GRANT SELECT ON pure.user_profiles TO authenticated;

-- 5. Create round tracking tables (needed for caddy functionality)
CREATE TABLE IF NOT EXISTS pure.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id text UNIQUE,
    name text NOT NULL,
    location geography(POINT, 4326),
    address jsonb,
    phone text,
    website text,
    tee_sets jsonb DEFAULT '[]'::jsonb,
    last_updated timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pure.holes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid REFERENCES pure.courses(id) ON DELETE CASCADE,
    hole_number integer NOT NULL,
    par integer NOT NULL,
    handicap integer,
    yardages jsonb DEFAULT '{}'::jsonb,
    description text,
    gps_coordinates jsonb,
    hazards jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(course_id, hole_number)
);

CREATE TABLE IF NOT EXISTS pure.rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id uuid REFERENCES pure.courses(id),
    tee_set text NOT NULL,
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    weather jsonb,
    total_score integer,
    status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    notes text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pure.shots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id uuid REFERENCES pure.rounds(id) ON DELETE CASCADE,
    hole_number integer NOT NULL,
    shot_number integer NOT NULL,
    distance_to_target integer,
    lie_type text,
    lie_photo_url text,
    club_recommended text,
    club_used text,
    shot_result text,
    distance_achieved integer,
    accuracy_rating integer CHECK (accuracy_rating >= 1 AND accuracy_rating <= 10),
    gps_location geography(POINT, 4326),
    ai_confidence decimal(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    created_at timestamptz DEFAULT now()
);

-- 6. Add mode support tables (user club performance, etc.)
CREATE TABLE IF NOT EXISTS pure.user_club_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    club text NOT NULL,
    total_shots integer DEFAULT 0,
    avg_carry integer DEFAULT 0,
    avg_total integer DEFAULT 0,
    accuracy_percentage decimal(5,2) DEFAULT 0,
    miss_pattern text CHECK (miss_pattern IN ('left', 'right', 'straight', 'inconsistent')),
    bias_yards integer DEFAULT 0,
    last_10_distances integer[] DEFAULT '{}',
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(user_id, club)
);

-- 7. Add caddy quota table for freemium model (now rounds table exists)
CREATE TABLE IF NOT EXISTS pure.caddy_quota (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    round_id uuid REFERENCES pure.rounds(id),
    advice_count integer DEFAULT 0,
    quota_reached boolean DEFAULT false,
    strokes_saved decimal(3,1) DEFAULT 0,
    upgrade_prompted boolean DEFAULT false,
    date date DEFAULT CURRENT_DATE,
    
    UNIQUE(user_id, date)
);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_location ON pure.courses USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_courses_external_id ON pure.courses (external_id);

CREATE INDEX IF NOT EXISTS idx_holes_course_id ON pure.holes (course_id);
CREATE INDEX IF NOT EXISTS idx_holes_course_hole ON pure.holes (course_id, hole_number);

CREATE INDEX IF NOT EXISTS idx_rounds_user_id ON pure.rounds (user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_course_id ON pure.rounds (course_id);
CREATE INDEX IF NOT EXISTS idx_rounds_status ON pure.rounds (status);

CREATE INDEX IF NOT EXISTS idx_shots_round_id ON pure.shots (round_id);
CREATE INDEX IF NOT EXISTS idx_shots_round_hole ON pure.shots (round_id, hole_number);

CREATE INDEX IF NOT EXISTS idx_user_club_performance_user ON pure.user_club_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_user_club_performance_club ON pure.user_club_performance(club);

CREATE INDEX IF NOT EXISTS idx_caddy_quota_user_date ON pure.caddy_quota(user_id, date);

-- 9. Enable RLS on all tables
ALTER TABLE pure.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.user_club_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.caddy_quota ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies
-- Courses and holes are public (readable by all authenticated users)
DROP POLICY IF EXISTS "courses_select_policy" ON pure.courses;
DROP POLICY IF EXISTS "holes_select_policy" ON pure.holes;

CREATE POLICY "courses_select_policy" ON pure.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "holes_select_policy" ON pure.holes FOR SELECT TO authenticated USING (true);

-- User-owned data policies
DROP POLICY IF EXISTS "rounds_policy" ON pure.rounds;
DROP POLICY IF EXISTS "shots_policy" ON pure.shots;
DROP POLICY IF EXISTS "Users can manage own club performance" ON pure.user_club_performance;
DROP POLICY IF EXISTS "Users can manage own quota" ON pure.caddy_quota;

CREATE POLICY "rounds_policy" ON pure.rounds 
    FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "shots_policy" ON pure.shots 
    FOR ALL TO authenticated USING (
        auth.uid() = (SELECT user_id FROM pure.rounds WHERE id = round_id)
    );

CREATE POLICY "Users can manage own club performance" ON pure.user_club_performance
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own quota" ON pure.caddy_quota
    FOR ALL USING (auth.uid() = user_id);

-- 11. Grant permissions
GRANT SELECT, INSERT, UPDATE ON pure.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pure.holes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pure.rounds TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pure.shots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pure.user_club_performance TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pure.caddy_quota TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pure.profiles TO authenticated;

-- 12. Function to safely get user profile data for chat API
CREATE OR REPLACE FUNCTION pure.get_user_for_chat(user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT jsonb_build_object(
        'id', id,
        'email', email,
        'name', name,
        'handicap', handicap,
        'goals', goals
    )
    FROM pure.user_profiles
    WHERE id = user_id;
$$;

GRANT EXECUTE ON FUNCTION pure.get_user_for_chat(uuid) TO authenticated;

-- 13. Create a simple function to handle general chat (when swingId = 'general')
CREATE OR REPLACE FUNCTION pure.handle_general_chat_message(
    p_user_id uuid,
    p_message text,
    p_response text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    INSERT INTO pure.chat_messages (swing_id, user_id, role, content, created_at) VALUES
    (NULL, p_user_id, 'user', p_message, now()),
    (NULL, p_user_id, 'assistant', p_response, now());
$$;

GRANT EXECUTE ON FUNCTION pure.handle_general_chat_message(uuid, text, text) TO authenticated;

-- 14. Trigger to auto-create profile on user creation
CREATE OR REPLACE FUNCTION pure.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO pure.profiles (id, name, created_at)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'name', now())
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION pure.handle_new_user();

-- 15. Comments for documentation
COMMENT ON TABLE pure.courses IS 'Golf courses with location and metadata';
COMMENT ON TABLE pure.holes IS 'Individual holes for each course';
COMMENT ON TABLE pure.rounds IS 'User golf rounds tracking';
COMMENT ON TABLE pure.shots IS 'Individual shots within rounds';
COMMENT ON TABLE pure.user_club_performance IS 'Tracks user performance statistics by club for personalization';
COMMENT ON TABLE pure.caddy_quota IS 'Tracks freemium quota usage for monetization';
COMMENT ON VIEW pure.user_profiles IS 'Unified view of user data for API consumption';
COMMENT ON FUNCTION pure.handle_new_user() IS 'Automatically creates profile when user signs up';

-- 16. Add mode column comment
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'pure' AND table_name = 'swings' AND column_name = 'mode'
  ) THEN
    COMMENT ON COLUMN pure.swings.mode IS 'Swing analysis mode: training (3-angle) or quick (single-angle)';
  END IF;
END $$; 