-- Migration: add `unit` column to `positions`
-- Purpose: Store the unit of a GOLD position.
--          NULL is treated as 'oz' (troy ounce) by the application.
-- Valid values: 'oz' | 'g' | 'quarter' | 'half' | 'full' | 'republic'
--               (NULL = legacy / oz default)
-- Idempotent: safe to run multiple times.
-- RLS: no policy changes needed — column is part of the positions row,
--      which is already covered by the four user-scoped policies.

-- ─── Forward migration ────────────────────────────────────────────────────────

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT NULL;

-- Optional but recommended: prevent garbage values from being stored.
-- Drop and recreate if constraint already exists (idempotent guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'positions'
      AND constraint_name = 'positions_unit_check'
  ) THEN
    ALTER TABLE positions
      ADD CONSTRAINT positions_unit_check
      CHECK (
        unit IS NULL OR
        unit IN ('oz', 'g', 'quarter', 'half', 'full', 'republic')
      );
  END IF;
END;
$$;

-- ─── Verification ─────────────────────────────────────────────────────────────

-- Run this after applying to confirm success:
--
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'positions' AND column_name = 'unit';
--
-- Expected row:
--   column_name | data_type | column_default | is_nullable
--   unit        | text      | NULL           | YES
--
-- Confirm constraint:
--   SELECT constraint_name, check_clause
--   FROM information_schema.check_constraints
--   WHERE constraint_name = 'positions_unit_check';

-- ─── Rollback ─────────────────────────────────────────────────────────────────

-- To undo this migration completely:
--
--   ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_unit_check;
--   ALTER TABLE positions DROP COLUMN IF EXISTS unit;
