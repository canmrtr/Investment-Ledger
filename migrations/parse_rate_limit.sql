-- Migration: Add parse rate limiting fields to profiles
-- Purpose: Track daily AI parse call counts per user.
--          Written exclusively by service_role via the parse-transaction edge function.
--          RLS is NOT changed — service_role bypasses RLS, so no policy updates needed.
-- Idempotent: safe to run multiple times (IF NOT EXISTS guards).

-- ---------------------------------------------------------------------------
-- Forward migration
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS parse_calls_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parse_calls_date  DATE NOT NULL DEFAULT CURRENT_DATE;

-- parse_calls_today: number of AI parse invocations made by this user today.
--   Reset to 0 whenever parse_calls_date is earlier than CURRENT_DATE.
COMMENT ON COLUMN profiles.parse_calls_today IS
  'Count of AI parse (parse-transaction edge function) calls made by this user on parse_calls_date. Reset to 0 when a new calendar day begins.';

-- parse_calls_date: the calendar date parse_calls_today refers to.
--   When the edge function sees this date < CURRENT_DATE it resets the counter.
COMMENT ON COLUMN profiles.parse_calls_date IS
  'The calendar date (UTC) that parse_calls_today was last active. Used by the edge function to detect day roll-over and reset the counter.';

-- ---------------------------------------------------------------------------
-- Verification query
-- ---------------------------------------------------------------------------
-- Run after applying to confirm both columns exist with correct defaults:
--
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'profiles'
--   AND column_name  IN ('parse_calls_today', 'parse_calls_date')
-- ORDER BY column_name;
--
-- Expected rows:
--   parse_calls_date  | date    | CURRENT_DATE | NO
--   parse_calls_today | integer | 0            | NO

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- To undo this migration:
--
-- ALTER TABLE profiles
--   DROP COLUMN IF EXISTS parse_calls_today,
--   DROP COLUMN IF EXISTS parse_calls_date;
