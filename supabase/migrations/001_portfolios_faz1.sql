-- =============================================================================
-- Migration: 001_portfolios_faz1.sql
-- Description: Social Portfolios Faz 1 — portfolios, follows,
--              portfolio_activities tabloları; mevcut tablolara portfolio_id
--              FK'si; profil sosyal alanları; RLS politikaları.
-- Project: Investment Ledger (jfetubcilmuthpddkodg)
-- Date: 2026-04-29
-- Apply: Supabase Dashboard → SQL Editor → Run (tek seferde)
--
-- RLS Audit Notları (rls-auditor 2026-04-29):
--   - ON DELETE RESTRICT: portfolios silinince positions korunur (CASCADE yerine)
--   - Tüm public read policy'lerine auth.uid() IS NOT NULL eklendi (anon engeli)
--   - follows_follower_write: FOR ALL → INSERT + DELETE (UPDATE vektörü kaldırıldı)
--   - portfolios_public_read: auth.uid() IS NOT NULL eklendi
--   - activities/positions/transactions public read: auth.uid() IS NOT NULL eklendi
--   - Partial index portfolios(is_public) subquery performansı için
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. portfolios tablosu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portfolios (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL DEFAULT 'Ana Portföy',
  description   TEXT,
  is_public     BOOLEAN     NOT NULL DEFAULT FALSE,
  -- 'full'            → tüm işlemler public görünür
  -- 'allocation_only' → sadece dağılım yüzdeleri görünür, ticker/adet/fiyat gizli
  privacy_level TEXT        NOT NULL DEFAULT 'allocation_only'
                CHECK (privacy_level IN ('full', 'allocation_only')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolios_user_id_idx
  ON portfolios (user_id);

-- Partial index: public portfolio subquery'lerini hızlandırır (RLS policy'lerinde kullanılır)
CREATE INDEX IF NOT EXISTS portfolios_public_id_idx
  ON portfolios (id) WHERE is_public = TRUE;

-- updated_at otomatik güncelleme trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portfolios_set_updated_at ON portfolios;
CREATE TRIGGER portfolios_set_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. follows tablosu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  follower_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)   -- kullanıcı kendini takip edemez
);

-- Ters indeks: "beni kimler takip ediyor?" sorgusu için
CREATE INDEX IF NOT EXISTS follows_following_id_idx
  ON follows (following_id);

-- ---------------------------------------------------------------------------
-- 3. portfolio_activities tablosu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portfolio_activities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID        NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type   TEXT        NOT NULL
                  CHECK (activity_type IN ('buy', 'sell', 'position_add', 'position_remove')),
  ticker          TEXT,
  -- NOT: tutar/adet bilgisi kasıtlı olarak yok — privacy_level portfolios tablosunda
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_activities_portfolio_created_idx
  ON portfolio_activities (portfolio_id, created_at DESC);

CREATE INDEX IF NOT EXISTS portfolio_activities_user_id_idx
  ON portfolio_activities (user_id);

-- ---------------------------------------------------------------------------
-- 4. Mevcut tablolara portfolio_id FK ekle
--
-- ON DELETE RESTRICT (varsayılan — belirtilmemiş): Pozisyonu olan bir portföy
-- silinemez. Frontend önce pozisyonları taşımalı/silmeli. Bu kasıtlı:
-- CASCADE ile portföy silme → tüm pozisyon geçmişi kaybolurdu (veri kaybı riski).
-- ---------------------------------------------------------------------------

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS portfolio_id UUID
    REFERENCES portfolios(id) ON DELETE RESTRICT;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS portfolio_id UUID
    REFERENCES portfolios(id) ON DELETE RESTRICT;

ALTER TABLE splits
  ADD COLUMN IF NOT EXISTS portfolio_id UUID
    REFERENCES portfolios(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 5. Migration: Mevcut kullanıcılar için "Ana Portföy" oluştur + backfill
-- ---------------------------------------------------------------------------

-- 5a. Hiç portfolios kaydı olmayan kullanıcılar için "Ana Portföy" insert et.
--     profiles + positions + transactions UNION: profiles kaydı olmayan
--     ama işlemi olan kullanıcılar da dahil edilir.
INSERT INTO portfolios (user_id, name, is_public, privacy_level, created_at, updated_at)
SELECT
  all_users.user_id,
  'Ana Portföy',
  FALSE,
  'allocation_only',
  now(),
  now()
FROM (
  SELECT user_id FROM profiles
  UNION
  SELECT user_id FROM positions
  UNION
  SELECT user_id FROM transactions
) AS all_users
WHERE NOT EXISTS (
  SELECT 1 FROM portfolios p WHERE p.user_id = all_users.user_id
);

-- 5b. positions backfill
UPDATE positions pos
SET portfolio_id = (
  SELECT pf.id
  FROM portfolios pf
  WHERE pf.user_id = pos.user_id
  ORDER BY pf.created_at ASC   -- birden fazla portföy olursa en eskisi
  LIMIT 1
)
WHERE pos.portfolio_id IS NULL;

-- 5c. transactions backfill
UPDATE transactions tx
SET portfolio_id = (
  SELECT pf.id
  FROM portfolios pf
  WHERE pf.user_id = tx.user_id
  ORDER BY pf.created_at ASC
  LIMIT 1
)
WHERE tx.portfolio_id IS NULL;

-- 5d. splits backfill
UPDATE splits sp
SET portfolio_id = (
  SELECT pf.id
  FROM portfolios pf
  WHERE pf.user_id = sp.user_id
  ORDER BY pf.created_at ASC
  LIMIT 1
)
WHERE sp.portfolio_id IS NULL;

-- 5e. Backfill sonrası NOT NULL yap.
--     Herhangi bir satır hâlâ NULL ise (user_id auth.users'da yoksa) hata verir
--     ve migration atomik olarak rollback olur — güvenli fail-fast davranışı.
ALTER TABLE positions    ALTER COLUMN portfolio_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN portfolio_id SET NOT NULL;
ALTER TABLE splits       ALTER COLUMN portfolio_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. profiles tablosuna sosyal alanlar ekle
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio               TEXT,
  ADD COLUMN IF NOT EXISTS avatar_emoji      TEXT    DEFAULT '👤',
  ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT TRUE;

-- ---------------------------------------------------------------------------
-- 7. RLS Politikaları
--
-- Genel kural: Tüm public read policy'lerinde auth.uid() IS NOT NULL zorunlu.
-- Anon kullanıcılar (giriş yapmamış) hiçbir veriye erişemez.
-- ---------------------------------------------------------------------------

-- ── portfolios ──────────────────────────────────────────────────────────────
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- Sahibi kendi portföyleri üzerinde tam yetki (USING + WITH CHECK her ikisi de şart)
DROP POLICY IF EXISTS "portfolios_owner_all" ON portfolios;
CREATE POLICY "portfolios_owner_all" ON portfolios
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public portföyler: sadece authenticated kullanıcılar (anon erişimi engellenmiş)
DROP POLICY IF EXISTS "portfolios_public_read" ON portfolios;
CREATE POLICY "portfolios_public_read" ON portfolios
  FOR SELECT
  USING (is_public = TRUE AND auth.uid() IS NOT NULL);

-- ── follows ─────────────────────────────────────────────────────────────────
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- INSERT: sadece kendi takip kaydını oluşturabilir
DROP POLICY IF EXISTS "follows_follower_insert" ON follows;
CREATE POLICY "follows_follower_insert" ON follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- DELETE: sadece kendi takip kaydını silebilir
DROP POLICY IF EXISTS "follows_follower_delete" ON follows;
CREATE POLICY "follows_follower_delete" ON follows
  FOR DELETE
  USING (auth.uid() = follower_id);

-- SELECT: takip eden veya takip edilen her ikisi de okuyabilir
-- UPDATE kasıtlı olarak YOK: follow kaydı değiştirilemez (sil + tekrar ekle pattern'ı)
DROP POLICY IF EXISTS "follows_both_read" ON follows;
CREATE POLICY "follows_both_read" ON follows
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (auth.uid() = follower_id OR auth.uid() = following_id)
  );

-- ── portfolio_activities ─────────────────────────────────────────────────────
ALTER TABLE portfolio_activities ENABLE ROW LEVEL SECURITY;

-- Kayıt sahibi: INSERT + DELETE (UPDATE aktivite kaydı değiştirilemez)
DROP POLICY IF EXISTS "activities_owner_insert" ON portfolio_activities;
CREATE POLICY "activities_owner_insert" ON portfolio_activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "activities_owner_delete" ON portfolio_activities;
CREATE POLICY "activities_owner_delete" ON portfolio_activities
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public portföylerin aktiviteleri authenticated herkes okuyabilir
DROP POLICY IF EXISTS "activities_public_read" ON portfolio_activities;
CREATE POLICY "activities_public_read" ON portfolio_activities
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE is_public = TRUE
    )
  );

-- ── positions — public portföy okuma policy'si ───────────────────────────────
-- Not: Mevcut owner policy'sine ("positions_select_own" veya benzeri) dokunulmadı.
-- Bu policy ONA EK olarak çalışır (OR semantiği).
DROP POLICY IF EXISTS "positions_public_read" ON positions;
CREATE POLICY "positions_public_read" ON positions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND portfolio_id IN (
      SELECT id FROM portfolios WHERE is_public = TRUE
    )
  );

-- ── transactions — public + full_detail portföy okuma ───────────────────────
-- Sadece privacy_level = 'full' olan public portföylerin işlemleri görünür.
-- 'allocation_only' portföylerde transactions gizli kalır.
DROP POLICY IF EXISTS "transactions_public_read" ON transactions;
CREATE POLICY "transactions_public_read" ON transactions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND portfolio_id IN (
      SELECT id FROM portfolios
      WHERE is_public = TRUE AND privacy_level = 'full'
    )
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (gerekirse Supabase SQL Editor'da çalıştır):
-- BEGIN;
-- DROP TABLE IF EXISTS portfolio_activities CASCADE;
-- DROP TABLE IF EXISTS follows CASCADE;
-- ALTER TABLE splits       DROP COLUMN IF EXISTS portfolio_id;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS portfolio_id;
-- ALTER TABLE positions    DROP COLUMN IF EXISTS portfolio_id;
-- DROP TABLE IF EXISTS portfolios CASCADE;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS bio,
--                      DROP COLUMN IF EXISTS avatar_emoji,
--                      DROP COLUMN IF EXISTS is_profile_public;
-- DROP TRIGGER IF EXISTS portfolios_set_updated_at ON portfolios;
-- DROP FUNCTION IF EXISTS set_updated_at();
-- COMMIT;
-- =============================================================================

-- =============================================================================
-- DOĞRULAMA (migration sonrası SQL Editor'da çalıştır):
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('portfolios', 'follows', 'portfolio_activities')
-- ORDER BY table_name;
-- -- Beklenen: 3 satır
--
-- SELECT
--   (SELECT COUNT(*) FROM positions    WHERE portfolio_id IS NULL) AS pos_null,
--   (SELECT COUNT(*) FROM transactions WHERE portfolio_id IS NULL) AS tx_null,
--   (SELECT COUNT(*) FROM splits       WHERE portfolio_id IS NULL) AS splits_null;
-- -- Beklenen: 0, 0, 0
--
-- SELECT pf.name, pf.is_public, pf.privacy_level
-- FROM portfolios pf ORDER BY pf.created_at;
--
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('portfolios','follows','portfolio_activities','positions','transactions')
-- ORDER BY tablename, policyname;
-- =============================================================================
