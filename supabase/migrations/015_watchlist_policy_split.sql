-- Migration: 015_watchlist_policy_split.sql
--
-- Replaces the broad FOR ALL policy on `watchlist` with three
-- operation-specific policies: SELECT, INSERT, DELETE.
-- UPDATE is intentionally omitted — watchlist rows are immutable
-- (insert-or-delete only); no authenticated user can UPDATE any row.

BEGIN;

-- ============================================================
-- DROP old policy
-- ============================================================
DROP POLICY IF EXISTS "watchlist_own" ON watchlist;

-- ============================================================
-- SELECT — users can only read their own rows
-- ============================================================
CREATE POLICY "watchlist_select" ON watchlist
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- INSERT — users can only insert rows owned by themselves
-- ============================================================
CREATE POLICY "watchlist_insert" ON watchlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DELETE — users can only delete their own rows
-- ============================================================
CREATE POLICY "watchlist_delete" ON watchlist
  FOR DELETE
  USING (auth.uid() = user_id);

-- No UPDATE policy is created.
-- With RLS enabled and no UPDATE policy present, any UPDATE
-- attempt by an authenticated user returns 0 rows affected
-- (denied at DB level) without raising an error.

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'watchlist'
-- ORDER BY cmd;
--
-- Expected: 3 rows — SELECT, INSERT, DELETE.
-- No UPDATE row should appear.

-- ============================================================
-- ROLLBACK (paste and run to undo)
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "watchlist_select" ON watchlist;
-- DROP POLICY IF EXISTS "watchlist_insert" ON watchlist;
-- DROP POLICY IF EXISTS "watchlist_delete" ON watchlist;
-- CREATE POLICY "watchlist_own" ON watchlist
--   FOR ALL
--   USING  (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
-- COMMIT;
