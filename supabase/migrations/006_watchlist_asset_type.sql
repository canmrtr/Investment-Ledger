-- Migration 006: Add asset_type column to watchlist
-- Nullable TEXT column; existing rows are preserved with NULL value.
-- No new RLS policies required — existing watchlist policies remain unchanged.

BEGIN;

ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS asset_type TEXT;

COMMIT;

-- ============================================================
-- ROLLBACK (paste and run to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE watchlist DROP COLUMN IF EXISTS asset_type;
-- COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Confirm the column exists with the expected definition:
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'watchlist' AND column_name = 'asset_type';
--
-- Expected output:
--   column_name | data_type | is_nullable
--   ------------+-----------+------------
--   asset_type  | text      | YES
--
-- Confirm existing rows are unaffected (asset_type = NULL):
--
-- SELECT COUNT(*) FILTER (WHERE asset_type IS NULL) AS null_rows,
--        COUNT(*)                                   AS total_rows
-- FROM watchlist;
