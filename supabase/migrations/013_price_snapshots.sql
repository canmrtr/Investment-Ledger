-- =============================================================================
-- Migration: 013_price_snapshots.sql
-- Creates price_snapshots table for monthly price history.
-- Populated automatically by pg_cron on the 1st of each month at 00:05 UTC.
-- Frontend read-only (anon + authenticated). All writes via service_role / pg_cron.
-- =============================================================================

-- Create the table
CREATE TABLE IF NOT EXISTS price_snapshots (
  ticker        text    NOT NULL,
  snapshot_date date    NOT NULL,
  price         numeric NOT NULL,
  PRIMARY KEY (ticker, snapshot_date)
);

-- Enable RLS (no user_id; read is fully public, writes blocked for end users)
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read — anon and authenticated can SELECT; no INSERT/UPDATE/DELETE
CREATE POLICY "public read price_snapshots"
  ON price_snapshots FOR SELECT USING (true);

-- pg_cron: runs on the 1st of every month at 00:05 UTC.
-- Snapshots every ticker in price_cache that has a non-null price.
-- ON CONFLICT DO NOTHING is idempotent — safe to re-run if cron fires twice.
SELECT cron.schedule(
  'monthly-price-snapshot',
  '5 0 1 * *',
  $$
    INSERT INTO price_snapshots (ticker, snapshot_date, price)
    SELECT ticker, date_trunc('month', now())::date, price
    FROM price_cache
    WHERE price IS NOT NULL
    ON CONFLICT (ticker, snapshot_date) DO NOTHING;
  $$
);
