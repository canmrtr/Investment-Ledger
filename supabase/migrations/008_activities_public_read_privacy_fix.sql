-- =============================================================================
-- Migration 008: activities_public_read policy privacy fix
-- =============================================================================
-- Problem: activities_public_read policy, is_public = TRUE olan tüm portföylerin
--   aktivitelerini açıyor. privacy_level = 'allocation_only' portföylerde bu,
--   sahibinin hangi ticker'ı alıp sattığını (ticker + activity_type) diğer
--   authenticated kullanıcılara ifşa ediyor.
--
-- Referans: transactions_public_read (001_portfolios_faz1.sql, satır 278) zaten
--   AND privacy_level = 'full' koşulunu içeriyor. Bu migration, portfolio_activities
--   tablosunu aynı standarda getiriyor.
--
-- Değişiklik: mevcut policy DROP edilip privacy_level = 'full' koşuluyla
--   yeniden oluşturuluyor. Başka hiçbir policy'ye dokunulmuyor.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Mevcut policy'yi kaldır
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "activities_public_read" ON portfolio_activities;

-- ---------------------------------------------------------------------------
-- 2. privacy_level = 'full' koşuluyla yeniden oluştur
--    (transactions_public_read ile tutarlı)
-- ---------------------------------------------------------------------------
CREATE POLICY "activities_public_read" ON portfolio_activities
  FOR SELECT
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios
      WHERE is_public = TRUE
        AND privacy_level = 'full'
    )
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (gerekirse Supabase SQL Editor'da çalıştır):
-- =============================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "activities_public_read" ON portfolio_activities;
-- CREATE POLICY "activities_public_read" ON portfolio_activities
--   FOR SELECT
--   USING (
--     auth.uid() IS NOT NULL
--     AND portfolio_id IN (
--       SELECT id FROM portfolios WHERE is_public = TRUE
--     )
--   );
-- COMMIT;
-- =============================================================================

-- =============================================================================
-- DOĞRULAMA (migration sonrası Supabase SQL Editor'da çalıştır):
-- =============================================================================
-- -- Policy tanımının güncellendiğini doğrula:
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'portfolio_activities'
--   AND policyname = 'activities_public_read';
--
-- -- Beklenen çıktı:
-- --   policyname            | cmd    | qual
-- --   activities_public_read| SELECT | (portfolio_id IN (SELECT id FROM portfolios
-- --                         |        |   WHERE is_public = true
-- --                         |        |   AND privacy_level = 'full'))
--
-- -- Diğer portfolio_activities policy'lerinin etkilenmediğini doğrula:
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'portfolio_activities'
-- ORDER BY policyname;
--
-- -- Beklenen satırlar (değişmemeli):
-- --   activities_owner_delete → DELETE
-- --   activities_owner_insert → INSERT
-- --   activities_owner_select → SELECT  (owner kendi aktivitelerini görür)
-- --   activities_public_read  → SELECT  (sadece privacy_level = 'full' portföyler)
-- =============================================================================
