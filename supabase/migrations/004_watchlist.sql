-- Migration 004: Create watchlist table
-- User-scoped watchlist; global to the user (not per-portfolio).
-- Follows the same user-isolation pattern as positions and transactions.
--
-- NOTE: Verify linked project with:
--   SELECT current_database(), current_user;

BEGIN;

-- ============================================================
-- TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker     TEXT   NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate entries for the same user+ticker pair
  UNIQUE(user_id, ticker)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Single FOR ALL policy; covers SELECT / INSERT / UPDATE / DELETE.
-- users can only touch their own rows.
CREATE POLICY "watchlist_own" ON watchlist
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;

-- ============================================================
-- ROLLBACK (paste and run to undo this migration)
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "watchlist_own" ON watchlist;
-- DROP TABLE IF EXISTS watchlist;
-- COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- -- 1. Table exists with correct columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'watchlist'
-- ORDER BY ordinal_position;
--
-- -- 2. RLS is enabled
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname = 'watchlist';
--
-- -- 3. Policy is present
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'watchlist';
--
-- -- 4. UNIQUE constraint is present
-- SELECT conname, contype, pg_get_constraintdef(oid) AS definition
-- FROM pg_constraint
-- WHERE conrelid = 'watchlist'::regclass;
