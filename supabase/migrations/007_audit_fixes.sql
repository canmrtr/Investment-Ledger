-- =============================================================================
-- Migration: 007_audit_fixes.sql
-- Description: Audit bulgularına göre 2 fix:
--
--   Finding 2 (HIGH): positions unique constraint — portfolio_id dahil edildi
--     Eski: UNIQUE (user_id, ticker)                    [positions_user_id_ticker_key]
--     Yeni: UNIQUE NULLS NOT DISTINCT (user_id, portfolio_id, ticker)
--     Gerekçe: Aynı kullanıcı farklı portföylerde aynı ticker'ı tutabilmeli;
--              eski constraint bunu blokluyordu. NULLS NOT DISTINCT (PG17):
--              portfolio_id NULL olsa bile (NULL, NULL, ticker) çakışır —
--              tek portföysüz kullanıcıda hatalı duplicate izni vermez.
--
--   Finding 4 (MEDIUM): positions_allocation_read policy — allocation_only portföyler
--     allocation_only privacy_level'ı olan public portföylerin positions satırları
--     şu an hiçbir SELECT policy tarafından kapsanmıyor (positions_public_read
--     sadece privacy_level = 'full' döndürüyor; owner select ise başkasının
--     portföyünü göstermiyor). Frontend allocation pie chart için sadece ticker
--     ve shares alanlarına read erişimi yeterli; avg_cost gizli kalmalı.
--     Bu policy ticker/shares/portfolio_id'ye görünürlük verir; avg_cost'u
--     gizlemek için frontend sorgu projeksiyonu yeterli (column-level RLS yok).
--
-- Project: Investment Ledger (jfetubcilmuthpddkodg)
-- Date: 2026-05-01
-- Apply: Supabase Dashboard → SQL Editor → Run
--        UYARI: Önce incele, sonra çalıştır.
--        NOT: Constraint drop/create positions tablosunda kısa ACCESS EXCLUSIVE
--             lock alır. Production'da düşük trafikli saatte çalıştır.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Finding 2 (HIGH): positions unique constraint değişikliği
--
-- Önce eski constraint'i düşür, sonra yenisini ekle.
-- IF EXISTS guard: migration iki kez çalıştırılırsa güvenli.
--
-- NULLS NOT DISTINCT → PG15+ syntax; Supabase PG17 üzerinde destekleniyor.
-- Bu olmadan UNIQUE index NULL sütunları asla eşit saymaz —
-- (user_id, NULL, 'AAPL') iki farklı satır için çakışmaz ve tek portföysüz
-- kullanıcıda aynı ticker'ı defalarca insert etmeye izin verir.
-- ---------------------------------------------------------------------------

-- Eski constraint'i düşür
ALTER TABLE positions
  DROP CONSTRAINT IF EXISTS positions_user_id_ticker_key;

-- Yeni constraint: portfolio_id dahil, NULLS NOT DISTINCT
ALTER TABLE positions
  ADD CONSTRAINT positions_user_portfolio_ticker_key
    UNIQUE NULLS NOT DISTINCT (user_id, portfolio_id, ticker);

-- ---------------------------------------------------------------------------
-- Finding 4 (MEDIUM): positions_allocation_read — allocation_only portföyler
--
-- 002'de positions_public_read privacy_level = 'full' olarak daraltıldı.
-- Bu doğruydu; ancak allocation_only portföyler için hiç SELECT policy kalmadı.
-- Social feed / public portfolio sayfası bu portföylerin dağılım pie'ını
-- göstermeye çalıştığında 0 satır döner — veri yok gibi görünür.
--
-- Fix: allocation_only portföylere ait positions'ı authenticated kullanıcılara
-- okutacak ayrı bir SELECT policy ekle. avg_cost gizliliği frontend
-- projeksiyon sorumluluğundadır (SELECT ticker, shares, portfolio_id ...).
--
-- Idempotent: DROP IF EXISTS → CREATE
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "positions_allocation_read" ON positions;

CREATE POLICY "positions_allocation_read" ON positions
  FOR SELECT
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios
      WHERE is_public     = TRUE
        AND privacy_level = 'allocation_only'
        AND user_id       = positions.user_id
    )
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (bu migration'ı geri almak için):
-- =============================================================================
--
-- BEGIN;
--
-- -- Finding 2: yeni constraint'i düşür, eskisini geri yükle
-- ALTER TABLE positions
--   DROP CONSTRAINT IF EXISTS positions_user_portfolio_ticker_key;
--
-- ALTER TABLE positions
--   ADD CONSTRAINT positions_user_id_ticker_key
--     UNIQUE (user_id, ticker);
--
-- -- Finding 4: allocation_read policy'sini kaldır
-- DROP POLICY IF EXISTS "positions_allocation_read" ON positions;
--
-- COMMIT;

-- =============================================================================
-- DOĞRULAMA (migration sonrası SQL Editor'da çalıştır):
-- =============================================================================

-- 1. Eski constraint YOK, yeni constraint VAR olmalı
-- SELECT conname, contype, pg_get_constraintdef(oid) AS definition
-- FROM pg_constraint
-- WHERE conrelid = 'positions'::regclass
--   AND contype = 'u'
-- ORDER BY conname;
-- -- Beklenen:
-- --   positions_user_portfolio_ticker_key | u | UNIQUE NULLS NOT DISTINCT (user_id, portfolio_id, ticker)
-- -- OLMAMALI:
-- --   positions_user_id_ticker_key

-- 2. positions_allocation_read policy VAR olmalı
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'positions'
--   AND policyname = 'positions_allocation_read';
-- -- Beklenen: 1 satır, cmd = SELECT,
-- --   qual içinde: is_public = TRUE AND privacy_level = 'allocation_only'

-- 3. Tüm positions policy listesi (002 sonrası beklenen + 007 eklentisi)
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'positions'
-- ORDER BY policyname;
-- -- Beklenen policy isimleri:
-- --   positions_allocation_read   → SELECT   (007 YENİ)
-- --   positions_delete_own        → DELETE
-- --   positions_insert_own        → INSERT
-- --   positions_public_read       → SELECT   (002: privacy_level = 'full')
-- --   positions_select_own        → SELECT
-- --   positions_update_own        → UPDATE

-- 4. Constraint davranış testi — aynı (user_id, portfolio_id, ticker) çakışmalı:
-- -- $UID ve $PF_ID değerlerini kendi ortamınıza göre değiştirin.
-- INSERT INTO positions (user_id, portfolio_id, ticker, name, type, shares, avg_cost, currency)
-- VALUES ($UID, $PF_ID, 'AAPL', 'Apple', 'US_STOCK', 1, 100, 'USD');
-- INSERT INTO positions (user_id, portfolio_id, ticker, name, type, shares, avg_cost, currency)
-- VALUES ($UID, $PF_ID, 'AAPL', 'Apple', 'US_STOCK', 2, 110, 'USD');
-- -- Beklenen: ikinci INSERT → duplicate key value violates unique constraint

-- 5. Farklı portföylerde aynı ticker → ÇAKIŞMAMALI:
-- INSERT INTO positions (user_id, portfolio_id, ticker, ...) VALUES ($UID, $PF_ID_1, 'AAPL', ...);
-- INSERT INTO positions (user_id, portfolio_id, ticker, ...) VALUES ($UID, $PF_ID_2, 'AAPL', ...);
-- -- Beklenen: her iki INSERT da başarılı
-- =============================================================================
