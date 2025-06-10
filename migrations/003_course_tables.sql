-- Migration: Add course tracking tables for Round Tracker + AI Caddy
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