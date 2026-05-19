-- =============================================================================
-- Migration: 019_bes_update_atomic.sql
-- Atomic BES update: positions.dk_current + price_cache.price in one transaction.
-- Replaces the previous two-step (set-manual-price then UPDATE positions) flow,
-- which could partial-commit and leave inconsistent state across users.
-- SECURITY DEFINER so the function can write the shared price_cache table while
-- still enforcing per-user ownership via auth.uid().
-- Addresses audit.md (2026-05-17) findings: BES atomicity (Medium) +
-- complements the set-manual-price hardening (High).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bes_update_atomic(
  p_ticker      text,
  p_total       numeric,
  p_dk_current  numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count   int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF p_ticker IS NULL OR length(trim(p_ticker)) = 0 THEN
    RAISE EXCEPTION 'ticker required' USING ERRCODE = '22023';
  END IF;
  IF p_total IS NULL OR p_total <= 0 THEN
    RAISE EXCEPTION 'invalid total' USING ERRCODE = '22023';
  END IF;
  IF p_dk_current IS NULL OR p_dk_current < 0 THEN
    RAISE EXCEPTION 'invalid dk_current' USING ERRCODE = '22023';
  END IF;

  UPDATE positions
     SET dk_current = p_dk_current
   WHERE user_id = v_user_id
     AND ticker  = upper(p_ticker)
     AND type    = 'BES';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'no BES position for this ticker' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO price_cache (ticker, price, updated_at)
  VALUES (upper(p_ticker), p_total, now())
  ON CONFLICT (ticker) DO UPDATE
    SET price = EXCLUDED.price,
        updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.bes_update_atomic(text, numeric, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.bes_update_atomic(text, numeric, numeric) TO authenticated;
