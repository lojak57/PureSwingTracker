-- Migration: Add support for Training/Quick Fix modes and personalization
-- File: migrations/add_mode_support.sql

-- Add mode column to swings table
ALTER TABLE pure.swings 
ADD COLUMN mode text DEFAULT 'training' 
CHECK (mode IN ('training', 'quick'));

-- Add index for mode queries
CREATE INDEX idx_swings_mode ON pure.swings(mode);
CREATE INDEX idx_swings_user_mode ON pure.swings(user_id, mode);

-- Add personal tendencies to profiles
ALTER TABLE pure.profiles 
ADD COLUMN personal_tendencies jsonb;

-- Create user club performance tracking table
CREATE TABLE pure.user_club_performance (
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

-- Add indexes for club performance
CREATE INDEX idx_user_club_performance_user ON pure.user_club_performance(user_id);
CREATE INDEX idx_user_club_performance_club ON pure.user_club_performance(club);

-- Create caddy advice tracking table
CREATE TABLE pure.caddy_advice (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    round_id uuid REFERENCES pure.rounds(id) ON DELETE CASCADE,
    hole_number integer,
    distance_to_target integer,
    lie_type text,
    recommended_club text,
    reasoning text,
    confidence decimal(3,2),
    advice_followed boolean,
    actual_club_used text,
    outcome text,
    strokes_saved decimal(2,1),
    created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for caddy advice
CREATE INDEX idx_caddy_advice_user ON pure.caddy_advice(user_id);
CREATE INDEX idx_caddy_advice_round ON pure.caddy_advice(round_id);
CREATE INDEX idx_caddy_advice_created ON pure.caddy_advice(created_at);

-- Create quota tracking table for freemium model
CREATE TABLE pure.caddy_quota (
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

-- Add indexes for quota tracking
CREATE INDEX idx_caddy_quota_user_date ON pure.caddy_quota(user_id, date);

-- Create function to update user club performance
CREATE OR REPLACE FUNCTION update_user_club_performance(
    p_user_id uuid,
    p_club text,
    p_carry_distance integer,
    p_total_distance integer,
    p_accuracy boolean
) RETURNS void AS $$
BEGIN
    INSERT INTO pure.user_club_performance (
        user_id, 
        club, 
        total_shots, 
        avg_carry, 
        avg_total,
        accuracy_percentage,
        last_10_distances
    ) VALUES (
        p_user_id, 
        p_club, 
        1, 
        p_carry_distance, 
        p_total_distance,
        CASE WHEN p_accuracy THEN 100 ELSE 0 END,
        ARRAY[p_carry_distance]
    )
    ON CONFLICT (user_id, club) DO UPDATE SET
        total_shots = pure.user_club_performance.total_shots + 1,
        avg_carry = (pure.user_club_performance.avg_carry * pure.user_club_performance.total_shots + p_carry_distance) / (pure.user_club_performance.total_shots + 1),
        avg_total = (pure.user_club_performance.avg_total * pure.user_club_performance.total_shots + p_total_distance) / (pure.user_club_performance.total_shots + 1),
        accuracy_percentage = (
            (pure.user_club_performance.accuracy_percentage * pure.user_club_performance.total_shots / 100) + 
            CASE WHEN p_accuracy THEN 1 ELSE 0 END
        ) * 100 / (pure.user_club_performance.total_shots + 1),
        last_10_distances = (
            CASE 
                WHEN array_length(pure.user_club_performance.last_10_distances, 1) >= 10 
                THEN array_append(pure.user_club_performance.last_10_distances[2:10], p_carry_distance)
                ELSE array_append(pure.user_club_performance.last_10_distances, p_carry_distance)
            END
        ),
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate personal tendencies
CREATE OR REPLACE FUNCTION calculate_personal_tendencies(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
    result jsonb := '{}';
    club_bias jsonb := '{}';
    shot_count integer;
BEGIN
    -- Get total shots for confidence calculation
    SELECT COUNT(*) INTO shot_count
    FROM pure.shots 
    WHERE user_id = p_user_id;
    
    -- Calculate club bias from shots
    SELECT jsonb_object_agg(club, bias) INTO club_bias
    FROM (
        SELECT 
            club_used as club,
            ROUND(AVG(actual_distance - intended_distance)) as bias
        FROM pure.shots 
        WHERE user_id = p_user_id 
            AND actual_distance IS NOT NULL 
            AND intended_distance IS NOT NULL
            AND club_used IS NOT NULL
        GROUP BY club_used
        HAVING COUNT(*) >= 3 AND ABS(AVG(actual_distance - intended_distance)) > 2
    ) club_biases;
    
    -- Build result JSON
    result := jsonb_build_object(
        'club_bias', COALESCE(club_bias, '{}'),
        'confidence_level', LEAST(shot_count::decimal / 100, 1.0),
        'last_updated', extract(epoch from now())
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update personal tendencies after shot insert
CREATE OR REPLACE FUNCTION trigger_update_personal_tendencies()
RETURNS trigger AS $$
BEGIN
    -- Only update for training mode swings to avoid noise
    IF NEW.mode = 'training' THEN
        -- Update personal tendencies asynchronously (in practice, this would be a background job)
        UPDATE pure.profiles 
        SET personal_tendencies = calculate_personal_tendencies(NEW.user_id)
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on swings table
CREATE TRIGGER trigger_swings_update_tendencies
    AFTER INSERT ON pure.swings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_personal_tendencies();

-- Add RLS policies for new tables
ALTER TABLE pure.user_club_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.caddy_advice ENABLE ROW LEVEL SECURITY;
ALTER TABLE pure.caddy_quota ENABLE ROW LEVEL SECURITY;

-- User can only see their own data
CREATE POLICY "Users can view own club performance" ON pure.user_club_performance
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own club performance" ON pure.user_club_performance
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own caddy advice" ON pure.caddy_advice
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own caddy advice" ON pure.caddy_advice
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own quota" ON pure.caddy_quota
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quota" ON pure.caddy_quota
    FOR ALL USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON pure.user_club_performance TO authenticated;
GRANT SELECT, INSERT ON pure.caddy_advice TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pure.caddy_quota TO authenticated;

-- Create view for user swing analytics
CREATE VIEW pure.user_swing_analytics AS
SELECT 
    s.user_id,
    s.mode,
    COUNT(*) as total_swings,
    AVG(CAST((s.ai_flaws->>'swing_score')::text AS integer)) as avg_swing_score,
    COUNT(*) FILTER (WHERE s.mode = 'training') as training_swings,
    COUNT(*) FILTER (WHERE s.mode = 'quick') as quick_swings,
    DATE_TRUNC('week', s.created_at) as week
FROM pure.swings s
WHERE s.ai_flaws IS NOT NULL
GROUP BY s.user_id, s.mode, DATE_TRUNC('week', s.created_at);

GRANT SELECT ON pure.user_swing_analytics TO authenticated;

-- Comment the migration
COMMENT ON TABLE pure.user_club_performance IS 'Tracks user performance statistics by club for personalization';
COMMENT ON TABLE pure.caddy_advice IS 'Stores caddy recommendations and outcomes for learning';
COMMENT ON TABLE pure.caddy_quota IS 'Tracks freemium quota usage for monetization';
COMMENT ON COLUMN pure.swings.mode IS 'Swing analysis mode: training (3-angle) or quick (single-angle)';
COMMENT ON COLUMN pure.profiles.personal_tendencies IS 'JSON blob of calculated user tendencies for personalization'; 