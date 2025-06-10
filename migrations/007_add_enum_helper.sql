-- Add helper function for enum validation in health checks
CREATE OR REPLACE FUNCTION public.get_enum_values(enum_name text)
RETURNS text[] AS $$
BEGIN
  CASE enum_name
    WHEN 'swing_status' THEN
      RETURN ARRAY['queued', 'processing', 'completed', 'failed'];
    ELSE
      RETURN ARRAY[]::text[];
  END CASE;
END;
$$ LANGUAGE plpgsql; 