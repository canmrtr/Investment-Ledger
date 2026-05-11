-- =============================================================================
-- Migration: 017_deposit_reserve.sql
-- Add reserve_ratio to positions for hybrid deposit accounts (e.g. Serbest Plus).
-- Update rebuild_positions_atomic to persist the new column.
-- =============================================================================

BEGIN;

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS reserve_ratio numeric DEFAULT 0;

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

  IF p_positions IS NOT NULL AND jsonb_array_length(p_positions) > 0 THEN
    INSERT INTO positions (
      user_id, portfolio_id, ticker, name, type,
      shares, avg_cost, currency, broker, unit,
      interest_rate, maturity_date, reserve_ratio,
      updated_at
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
      NULLIF(el->>'interest_rate', '')::numeric,
      NULLIF(el->>'maturity_date', '')::date,
      COALESCE(NULLIF(el->>'reserve_ratio', '')::numeric, 0),
      (el->>'updated_at')::timestamptz
    FROM jsonb_array_elements(p_positions) AS el;

    GET DIAGNOSTICS inserted = ROW_COUNT;
  END IF;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION rebuild_positions_atomic(uuid, uuid, jsonb) TO authenticated;

COMMIT;
