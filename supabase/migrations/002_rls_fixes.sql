-- =============================================================================
-- Migration: 002_rls_fixes.sql
-- Description: RLS hardening — rls-auditor 2026-04-29 bulgularına göre 5 fix:
--
--   Finding 1 (HIGH): positions_public_read → privacy_level = 'full' kontrolü eklendi
--   Finding 2 (HIGH): activities_owner_insert → portfolio_id sahiplik doğrulaması eklendi
--   Finding 3 (HIGH): positions INSERT/UPDATE → portfolio_id sahiplik doğrulaması eklendi
--   Finding 4 (HIGH): transactions INSERT/UPDATE → portfolio_id sahiplik doğrulaması eklendi
--   Finding 5 (MEDIUM): portfolios_owner_all → 4 ayrı operation-specific policy'ye bölündü
--   Ek: splits INSERT/UPDATE → portfolio_id sahiplik doğrulaması
--   Ek: splits_public_read → transactions_public_read ile tutarlı (privacy_level = 'full')
--
-- Project: Investment Ledger (jfetubcilmuthpddkodg)
-- Date: 2026-04-29
-- Apply: Supabase Dashboard → SQL Editor → Run
--        UYARI: Önce incele, sonra çalıştır.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- YARDIMCI MACRO: portfolio sahiplik doğrulaması için inline subquery
--
-- Kullanım pattern'ı:
--   portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
--
-- Neden subquery, neden JOIN değil: RLS policy'lerinde lateral join desteksiz;
-- subquery semantiği daha açık ve pg planner partial index'i kullanır.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Finding 5 (MEDIUM): portfolios_owner_all → 4 ayrı policy
--
-- FOR ALL policy, SELECT + INSERT + UPDATE + DELETE'i tek WITH CHECK / USING
-- çiftiyle yönetir. Bu, DELETE için bile WITH CHECK kontrolü tetiklenebilir
-- davranış belirsizliğine yol açar. 4 ayrıya bölmek her operation'ın tam
-- olarak hangi kontrolleri geçtiğini netleştirir.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "portfolios_owner_all" ON portfolios;

-- Kendi portföylerini okuyabilir
CREATE POLICY "portfolios_owner_select" ON portfolios
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Sadece kendi user_id'siyle portföy oluşturabilir
CREATE POLICY "portfolios_owner_insert" ON portfolios
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Sadece kendi portföyünü güncelleyebilir
CREATE POLICY "portfolios_owner_update" ON portfolios
  FOR UPDATE
  USING     (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Sadece kendi portföyünü silebilir
CREATE POLICY "portfolios_owner_delete" ON portfolios
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- portfolios_public_read 001'de doğru yazılmış, dokunma.

-- ---------------------------------------------------------------------------
-- Finding 1 (HIGH): positions_public_read — privacy_level = 'full' kontrolü
--
-- 001'deki hata: is_public = TRUE yeterliydi; bu allocation_only portföylerin
-- raw ticker/shares/avg_cost verilerini de public etti.
-- Fix: subquery'ye AND privacy_level = 'full' koşulu eklendi.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "positions_public_read" ON positions;
CREATE POLICY "positions_public_read" ON positions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND portfolio_id IN (
      SELECT id FROM portfolios
      WHERE is_public = TRUE
        AND privacy_level = 'full'   -- allocation_only portföyler raw pos expose etmez
    )
  );

-- ---------------------------------------------------------------------------
-- Finding 3 (HIGH): positions INSERT/UPDATE — portfolio_id sahiplik doğrulaması
--
-- Sorun: Kullanıcı kendi user_id'siyle ama başkasının portfolio_id'siyle
-- satır yazabiliyordu. Hem USING (UPDATE'in read tarafı) hem WITH CHECK'e
-- portfolio sahiplik subquery'si eklendi.
--
-- Olası mevcut policy isimleri — DB'de hangisi varsa IF EXISTS guard'ı yakalar:
--   "positions_insert_own", "positions insert", "insert own", "positions_insert"
-- ---------------------------------------------------------------------------

-- INSERT
DROP POLICY IF EXISTS "positions_insert_own"    ON positions;
DROP POLICY IF EXISTS "positions insert"         ON positions;
DROP POLICY IF EXISTS "insert own"               ON positions;
DROP POLICY IF EXISTS "positions_insert"         ON positions;

CREATE POLICY "positions_insert_own" ON positions
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "positions_update_own"    ON positions;
DROP POLICY IF EXISTS "positions update"         ON positions;
DROP POLICY IF EXISTS "update own"               ON positions;
DROP POLICY IF EXISTS "positions_update"         ON positions;

CREATE POLICY "positions_update_own" ON positions
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- DELETE: portfolio_id sahiplik kontrolü ekle (daha önce sadece user_id vardı)
DROP POLICY IF EXISTS "positions_delete_own"    ON positions;
DROP POLICY IF EXISTS "positions delete"         ON positions;
DROP POLICY IF EXISTS "delete own"               ON positions;
DROP POLICY IF EXISTS "positions_delete"         ON positions;

CREATE POLICY "positions_delete_own" ON positions
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    -- DELETE için portfolio_id tutarsızlık senaryosu düşük ama savunma amaçlı:
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- SELECT: owner select policy (zaten vardı, isim normalize et + portfolio guard ekle)
DROP POLICY IF EXISTS "positions_select_own"    ON positions;
DROP POLICY IF EXISTS "positions select"         ON positions;
DROP POLICY IF EXISTS "select own"               ON positions;
DROP POLICY IF EXISTS "positions_select"         ON positions;

CREATE POLICY "positions_select_own" ON positions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );
-- Not: SELECT için portfolio_id subquery gerekmez — user_id eşleşmesi yeterli.
-- portfolio_id FK zaten DB seviyesinde bütünlüğü garanti eder.

-- ---------------------------------------------------------------------------
-- Finding 4 (HIGH): transactions INSERT/UPDATE — portfolio_id sahiplik doğrulaması
--
-- positions ile birebir aynı pattern. Mevcut olası policy isimleri IF EXISTS ile drop.
-- ---------------------------------------------------------------------------

-- INSERT
DROP POLICY IF EXISTS "transactions_insert_own"    ON transactions;
DROP POLICY IF EXISTS "transactions insert"         ON transactions;
DROP POLICY IF EXISTS "insert own"                  ON transactions;  -- başka tabloda aynı isim varsa etkilemez (table-scoped)
DROP POLICY IF EXISTS "transactions_insert"         ON transactions;

CREATE POLICY "transactions_insert_own" ON transactions
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "transactions_update_own"    ON transactions;
DROP POLICY IF EXISTS "transactions update"         ON transactions;
DROP POLICY IF EXISTS "transactions_update"         ON transactions;

CREATE POLICY "transactions_update_own" ON transactions
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- DELETE
DROP POLICY IF EXISTS "transactions_delete_own"    ON transactions;
DROP POLICY IF EXISTS "transactions delete"         ON transactions;
DROP POLICY IF EXISTS "transactions_delete"         ON transactions;

CREATE POLICY "transactions_delete_own" ON transactions
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- SELECT
DROP POLICY IF EXISTS "transactions_select_own"    ON transactions;
DROP POLICY IF EXISTS "transactions select"         ON transactions;
DROP POLICY IF EXISTS "transactions_select"         ON transactions;

CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- transactions_public_read 001'de doğru yazılmış (privacy_level = 'full' vardı), dokunma.

-- ---------------------------------------------------------------------------
-- Finding 2 (HIGH): activities_owner_insert — portfolio_id sahiplik doğrulaması
--
-- Sorun: Kullanıcı herhangi bir portfolio_id ile aktivite insert edebiliyordu.
-- Fix: WITH CHECK'e portfolios sahiplik subquery'si eklendi.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "activities_owner_insert" ON portfolio_activities;
CREATE POLICY "activities_owner_insert" ON portfolio_activities
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- activities_owner_delete ve activities_public_read 001'de doğru, dokunma.

-- ---------------------------------------------------------------------------
-- Ek: splits — portfolio_id sahiplik doğrulaması (positions/transactions ile tutarlı)
--
-- 001'de splits için owner policy yazılmamıştı; sadece portfolio_id FK eklenmişti.
-- Mevcut pre-existing owner policy'ler varsa normalize et + portfolio guard ekle.
-- ---------------------------------------------------------------------------

-- RLS splits tablosunda aktif mi? Aktif değilse önce enable et.
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;

-- INSERT
DROP POLICY IF EXISTS "splits_insert_own"    ON splits;
DROP POLICY IF EXISTS "splits insert"         ON splits;
DROP POLICY IF EXISTS "splits_insert"         ON splits;

CREATE POLICY "splits_insert_own" ON splits
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "splits_update_own"    ON splits;
DROP POLICY IF EXISTS "splits update"         ON splits;
DROP POLICY IF EXISTS "splits_update"         ON splits;

CREATE POLICY "splits_update_own" ON splits
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- DELETE
DROP POLICY IF EXISTS "splits_delete_own"    ON splits;
DROP POLICY IF EXISTS "splits delete"         ON splits;
DROP POLICY IF EXISTS "splits_delete"         ON splits;

CREATE POLICY "splits_delete_own" ON splits
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- SELECT
DROP POLICY IF EXISTS "splits_select_own"    ON splits;
DROP POLICY IF EXISTS "splits select"         ON splits;
DROP POLICY IF EXISTS "splits_select"         ON splits;

CREATE POLICY "splits_select_own" ON splits
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Ek: splits_public_read — transactions_public_read ile tutarlı
-- Sadece privacy_level = 'full' olan public portföylerin split geçmişi görünür.
DROP POLICY IF EXISTS "splits_public_read" ON splits;
CREATE POLICY "splits_public_read" ON splits
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND portfolio_id IN (
      SELECT id FROM portfolios
      WHERE is_public = TRUE
        AND privacy_level = 'full'
    )
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (bu migration'ı geri almak için):
-- =============================================================================
--
-- BEGIN;
--
-- -- portfolios: 4 ayrı policy → eski FOR ALL policy'ye dön
-- DROP POLICY IF EXISTS "portfolios_owner_select" ON portfolios;
-- DROP POLICY IF EXISTS "portfolios_owner_insert" ON portfolios;
-- DROP POLICY IF EXISTS "portfolios_owner_update" ON portfolios;
-- DROP POLICY IF EXISTS "portfolios_owner_delete" ON portfolios;
-- CREATE POLICY "portfolios_owner_all" ON portfolios
--   FOR ALL
--   USING     (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
--
-- -- positions: 001'deki hatalı positions_public_read'i geri yükle
-- DROP POLICY IF EXISTS "positions_public_read"   ON positions;
-- CREATE POLICY "positions_public_read" ON positions
--   FOR SELECT
--   USING (
--     auth.uid() IS NOT NULL
--     AND portfolio_id IN (SELECT id FROM portfolios WHERE is_public = TRUE)
--   );
--
-- -- positions: portfolio sahiplik kontrolsüz versiyonlar (001 öncesi default)
-- DROP POLICY IF EXISTS "positions_insert_own"    ON positions;
-- DROP POLICY IF EXISTS "positions_update_own"    ON positions;
-- DROP POLICY IF EXISTS "positions_delete_own"    ON positions;
-- DROP POLICY IF EXISTS "positions_select_own"    ON positions;
-- -- Not: 001 öncesi policy isimlerini bilmeden tam restore mümkün değil.
-- -- DB'de pg_policies snapshot'ı yoksa bu adımı manuel tamamla.
--
-- -- transactions: aynı pattern
-- DROP POLICY IF EXISTS "transactions_insert_own" ON transactions;
-- DROP POLICY IF EXISTS "transactions_update_own" ON transactions;
-- DROP POLICY IF EXISTS "transactions_delete_own" ON transactions;
-- DROP POLICY IF EXISTS "transactions_select_own" ON transactions;
--
-- -- activities_owner_insert: portfolio sahiplik kontrolsüz versiyona dön
-- DROP POLICY IF EXISTS "activities_owner_insert" ON portfolio_activities;
-- CREATE POLICY "activities_owner_insert" ON portfolio_activities
--   FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
--
-- -- splits: 002'de eklenen tüm policy'leri kaldır
-- DROP POLICY IF EXISTS "splits_insert_own"    ON splits;
-- DROP POLICY IF EXISTS "splits_update_own"    ON splits;
-- DROP POLICY IF EXISTS "splits_delete_own"    ON splits;
-- DROP POLICY IF EXISTS "splits_select_own"    ON splits;
-- DROP POLICY IF EXISTS "splits_public_read"   ON splits;
--
-- COMMIT;

-- =============================================================================
-- DOĞRULAMA (migration sonrası SQL Editor'da çalıştır):
-- =============================================================================

-- 1. Tüm policy'leri listele — beklenen isimler aşağıda
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN (
--   'portfolios', 'positions', 'transactions', 'splits', 'portfolio_activities'
-- )
-- ORDER BY tablename, policyname;
--
-- Beklenen çıktı (tablename → policyname → cmd):
--   portfolio_activities → activities_owner_delete  → DELETE
--   portfolio_activities → activities_owner_insert  → INSERT
--   portfolio_activities → activities_public_read   → SELECT
--   portfolios           → portfolios_owner_delete  → DELETE
--   portfolios           → portfolios_owner_insert  → INSERT
--   portfolios           → portfolios_owner_select  → SELECT
--   portfolios           → portfolios_owner_update  → UPDATE
--   portfolios           → portfolios_public_read   → SELECT
--   positions            → positions_delete_own     → DELETE
--   positions            → positions_insert_own     → INSERT
--   positions            → positions_public_read    → SELECT
--   positions            → positions_select_own     → SELECT
--   positions            → positions_update_own     → UPDATE
--   splits               → splits_delete_own        → DELETE
--   splits               → splits_insert_own        → INSERT
--   splits               → splits_public_read       → SELECT
--   splits               → splits_select_own        → SELECT
--   splits               → splits_update_own        → UPDATE
--   transactions         → transactions_delete_own  → DELETE
--   transactions         → transactions_insert_own  → INSERT
--   transactions         → transactions_public_read → SELECT
--   transactions         → transactions_select_own  → SELECT
--   transactions         → transactions_update_own  → UPDATE

-- 2. portfolios_owner_all policy'si YOK olmalı (Finding 5 gereği kaldırıldı)
-- SELECT COUNT(*) FROM pg_policies
-- WHERE tablename = 'portfolios' AND policyname = 'portfolios_owner_all';
-- -- Beklenen: 0

-- 3. positions_public_read subquery'sinde privacy_level = 'full' var mı?
-- SELECT qual FROM pg_policies
-- WHERE tablename = 'positions' AND policyname = 'positions_public_read';
-- -- Beklenen: ... AND privacy_level = 'full' ...

-- 4. activities_owner_insert WITH CHECK'de portfolio sahiplik subquery var mı?
-- SELECT with_check FROM pg_policies
-- WHERE tablename = 'portfolio_activities' AND policyname = 'activities_owner_insert';
-- -- Beklenen: ... portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()) ...

-- 5. Gerçek davranış testi (authenticated session gerektirir):
-- -- Kendi portföy ID'nizi $MY_PF_ID, başka kullanıcının portföy ID'sini $OTHER_PF_ID ile değiştirin.
-- INSERT INTO portfolio_activities (portfolio_id, user_id, activity_type, ticker)
-- VALUES ($OTHER_PF_ID, auth.uid(), 'buy', 'AAPL');
-- -- Beklenen: RLS violation hatası (new row violates row-level security)
-- =============================================================================
