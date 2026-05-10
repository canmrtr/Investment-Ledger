-- Migration: increment_parse_calls RPC
-- Purpose: Atomic parse call counter to prevent TOCTOU race across concurrent tabs.
--          Returns TRUE if the call is allowed (counter incremented).
--          Returns FALSE if the daily limit is already reached (caller returns 429).
-- Date: 2026-04-27

CREATE OR REPLACE FUNCTION increment_parse_calls(
  p_user_id uuid,
  p_today   date,
  p_limit   int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  UPDATE profiles SET
    parse_calls_today = CASE
      WHEN parse_calls_date = p_today THEN parse_calls_today + 1
      ELSE 1
    END,
    parse_calls_date = p_today
  WHERE user_id = p_user_id
    AND (
      parse_calls_date != p_today          -- new day → reset, always allow
      OR parse_calls_today < p_limit       -- same day but under limit
    );

  GET DIAGNOSTICS v_allowed = ROW_COUNT;
  RETURN v_allowed > 0;
END;
$$;
