-- =============================================================================
-- Migration: 011_rebuild_positions_atomic.sql
-- Fix: High #2 — rebuildPositions is delete-then-insert and not transactional.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION rebuild_positions_atomic(
  p_user_id      uuid,
  p_portfolio_id uuid,
  p_positions    jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  inserted int := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  DELETE FROM positions
  WHERE user_id = p_user_id AND portfolio_id = p_portfolio_id;

  IF jsonb_array_length(p_positions) > 0 THEN
    INSERT INTO positions (
      user_id, portfolio_id, ticker, name, type,
      shares, avg_cost, currency, broker, unit, updated_at
    )
    SELECT
      p_user_id,
      p_portfolio_id,
      el->>'ticker',
      el->>'name',
      el->>'type',
      (el->>'shares')::numeric,
      (el->>'avg_cost')::numeric,
      el->>'currency',
      el->>'broker',
      el->>'unit',
      (el->>'updated_at')::timestamptz
    FROM jsonb_array_elements(p_positions) AS el;

    GET DIAGNOSTICS inserted = ROW_COUNT;
  END IF;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION rebuild_positions_atomic(uuid, uuid, jsonb) TO authenticated;

COMMIT;
