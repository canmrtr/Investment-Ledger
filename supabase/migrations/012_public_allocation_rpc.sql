-- =============================================================================
-- Migration: 012_public_allocation_rpc.sql
-- Fix: High #1 — allocation_only public portfolios expose full positions rows.
-- Fix: Medium #3 — raw share counts used for allocation pct (meaningless cross-asset).
-- =============================================================================

BEGIN;

-- Drop the leaky RLS policy from migration 007.
DROP POLICY IF EXISTS "positions_allocation_read" ON positions;

-- SECURITY DEFINER: runs as function owner so it can read across user boundaries.
-- Returns only safe aggregate fields — avg_cost and shares are used internally
-- for cost-basis computation but never returned to the caller.
CREATE OR REPLACE FUNCTION get_allocation_only_positions(p_portfolio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio portfolios%ROWTYPE;
  v_total     numeric;
  v_result    jsonb;
BEGIN
  SELECT * INTO v_portfolio
  FROM portfolios
  WHERE id = p_portfolio_id
    AND is_public = TRUE
    AND privacy_level = 'allocation_only';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Portfolio not found or not public');
  END IF;

  SELECT COALESCE(SUM(p.avg_cost * p.shares), 0)
  INTO v_total
  FROM positions p
  WHERE p.portfolio_id = p_portfolio_id;

  IF v_total = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ticker', p.ticker,
      'name',   p.name,
      'type',   p.type,
      'pct',    ROUND((p.avg_cost * p.shares / v_total * 100)::numeric, 1)
    )
    ORDER BY (p.avg_cost * p.shares) DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM positions p
  WHERE p.portfolio_id = p_portfolio_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_allocation_only_positions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_allocation_only_positions(uuid) TO anon;

COMMIT;
