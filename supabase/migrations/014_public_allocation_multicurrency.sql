-- Migration: 014_public_allocation_multicurrency.sql
-- Update get_allocation_only_positions to normalise position values to USD
-- before computing allocation percentages, fixing cross-currency distortion.
-- Supported currencies: USD (no-op), TRY (÷ USDTRY rate), EUR (× EURUSD rate).
-- FX rates are read from price_cache; NULL rates fall back to 1 (safe default).
-- avg_cost, shares, and currency are never returned to the caller.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_allocation_only_positions(p_portfolio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usdtry  numeric;
  v_eurusd  numeric;
  v_total   numeric;
  v_result  jsonb;
BEGIN
  -- Verify the portfolio exists, is public, and is allocation_only.
  PERFORM 1
  FROM portfolios
  WHERE id             = p_portfolio_id
    AND is_public      = TRUE
    AND privacy_level  = 'allocation_only';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Portfolio not found or not public');
  END IF;

  -- Fetch FX rates once; default to 1 when unavailable to avoid divide-by-zero.
  SELECT COALESCE(price, 1) INTO v_usdtry
  FROM price_cache WHERE ticker = 'USDTRY';
  v_usdtry := COALESCE(v_usdtry, 1);

  SELECT COALESCE(price, 1) INTO v_eurusd
  FROM price_cache WHERE ticker = 'EURUSD';
  v_eurusd := COALESCE(v_eurusd, 1);

  -- Compute total portfolio value in USD, excluding dust / zero-share positions.
  -- Positions with no price_cache entry are excluded (pc.price NULL → NULL * shares = NULL).
  -- avg_cost is intentionally never used as a fallback to prevent pct reverse-engineering.
  SELECT COALESCE(
    SUM(
      CASE p.currency
        WHEN 'TRY' THEN
          pc.price * p.shares / NULLIF(v_usdtry, 0)
        WHEN 'EUR' THEN
          pc.price * p.shares * v_eurusd
        ELSE
          -- USD and any unknown currency treated as USD.
          pc.price * p.shares
      END
    ),
    0
  )
  INTO v_total
  FROM positions p
  LEFT JOIN price_cache pc ON pc.ticker = p.ticker
  WHERE p.portfolio_id = p_portfolio_id
    AND p.shares >= 0.0001;

  IF v_total = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Build result array sorted by USD value descending.
  -- Only ticker, name, type, and pct are returned — never avg_cost, shares, or currency.
  WITH valued AS (
    SELECT
      p.ticker,
      p.name,
      p.type,
      CASE p.currency
        WHEN 'TRY' THEN
          pc.price * p.shares / NULLIF(v_usdtry, 0)
        WHEN 'EUR' THEN
          pc.price * p.shares * v_eurusd
        ELSE
          pc.price * p.shares
      END AS value_usd
    FROM positions p
    LEFT JOIN price_cache pc ON pc.ticker = p.ticker
    WHERE p.portfolio_id = p_portfolio_id
      AND p.shares >= 0.0001
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'ticker', v.ticker,
        'name',   v.name,
        'type',   v.type,
        'pct',    ROUND((v.value_usd / v_total * 100)::numeric, 1)
      )
      ORDER BY v.value_usd DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM valued v;

  RETURN v_result;
END;
$$;

-- Only authenticated users may view public portfolios.
GRANT EXECUTE ON FUNCTION get_allocation_only_positions(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_allocation_only_positions(uuid) FROM anon;

COMMIT;
