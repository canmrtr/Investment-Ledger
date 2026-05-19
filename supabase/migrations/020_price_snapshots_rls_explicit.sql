-- =============================================================================
-- Migration: 020_price_snapshots_rls_explicit.sql
-- Make the price_snapshots SELECT policy explicitly scope to anon + authenticated
-- to match the comment in 013_price_snapshots.sql and mirror the pattern used by
-- fund_cache (009) and adr_bist_map (20260510). The previous `USING(true)`
-- without TO clause defaulted to PUBLIC, which is broader than the documented
-- intent.
-- Addresses audit.md (2026-05-17) Low finding.
-- =============================================================================

DROP POLICY IF EXISTS "public read price_snapshots" ON price_snapshots;

CREATE POLICY "public read price_snapshots"
  ON price_snapshots
  FOR SELECT
  TO anon, authenticated
  USING (true);
