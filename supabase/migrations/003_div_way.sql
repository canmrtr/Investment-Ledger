-- Migration 003: Extend transactions_way_check to include 'DIV'
-- Existing constraint only covers BUY/SELL; adding DIV for dividend records.
--
-- NOTE: Verify no unexpected values exist before applying:
--   SELECT DISTINCT way FROM transactions;
-- Expected result: only 'BUY' and 'SELL' rows (DIV was attempted and reverted).

BEGIN;

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_way_check;

-- Step 2: Add the updated CHECK constraint that includes 'DIV'
ALTER TABLE transactions
  ADD CONSTRAINT transactions_way_check
  CHECK (way = ANY (ARRAY['BUY'::text, 'SELL'::text, 'DIV'::text]));

COMMIT;

-- ============================================================
-- ROLLBACK (paste and run to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_way_check;
-- ALTER TABLE transactions ADD CONSTRAINT transactions_way_check
--   CHECK (way = ANY (ARRAY['BUY'::text, 'SELL'::text]));
-- COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT conname, pg_get_constraintdef(oid) AS definition
-- FROM pg_constraint
-- WHERE conrelid = 'transactions'::regclass AND conname = 'transactions_way_check';
--
-- Expected output:
--   conname                  | definition
--   -------------------------+-----------------------------------------------
--   transactions_way_check   | CHECK (way = ANY (ARRAY['BUY', 'SELL', 'DIV']))
