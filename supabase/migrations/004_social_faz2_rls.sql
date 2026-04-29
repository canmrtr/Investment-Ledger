-- =============================================================================
-- Migration: 004_social_faz2_rls.sql
-- Description: Social Faz 2 — public-read policy audit + profiles sosyal okuma
--
-- Bu migration 001/002'de yazılan public-read policy'lerini idempotent olarak
-- yeniden tanımlar (DROP IF EXISTS + CREATE pattern — projedeki yerleşik kural).
-- Ayrıca 002'de eksik kalan iki boşluğu kapatır:
--
--   Gap 1: profiles_public_read — Faz 1'de profiles tablosuna sosyal alanlar
--           (bio, avatar_emoji, is_profile_public) eklendi ancak SELECT policy
--           tanımlanmadı. is_profile_public = TRUE olan profiller authenticated
--           herkes tarafından okunabilmeli (ilerideki sosyal feed için).
--
--   Gap 2: follows_public_read — Takip listesi şu an sadece follower/following
--           tarafından görünür. Sosyal profil sayfası başkasının takip sayısını
--           gösterebilmeli; COUNT bazlı okumaya izin ver.
--
-- Mevcut policy'lere (001/002'de doğru yazılmış olanlar) ne olur:
--   - portfolios_public_read   → DROP + identical re-CREATE (idem, temizlik)
--   - positions_public_read    → DROP + identical re-CREATE (002'deki güçlü form)
--   - transactions_public_read → DROP + identical re-CREATE (001'deki güçlü form)
--   - splits_public_read       → DROP + identical re-CREATE (002'deki güçlü form)
--   - profiles_public_read     → YENİ (001/002'de yoktu)
--   - follows_public_count     → YENİ (001'deki follows_both_read sadece kendi
--                                 taraflarını gösteriyordu; başkalarının profili için eksik)
--
-- Project: Investment Ledger (jfetubcilmuthpddkodg)
-- Date: 2026-04-29
-- Apply: Supabase Dashboard → SQL Editor → Run
--        UYARI: Önce incele, sonra çalıştır. Migration atomik (BEGIN/COMMIT).
-- =============================================================================

-- Social Faz 2

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. profiles.is_profile_public backfill — opt-in yerine opt-out
--
-- 001'de DEFAULT TRUE eklendi; bu mevcut tüm kullanıcıları otomatik public yaptı.
-- rls-auditor LOW bulgusu: kullanıcı rızası olmadan profil görünür olmamalı.
-- Mevcut satırları FALSE'a çekiyoruz; kullanıcı Settings'ten opt-in yapabilir.
-- ---------------------------------------------------------------------------

UPDATE profiles SET is_profile_public = FALSE WHERE is_profile_public = TRUE OR is_profile_public IS NULL;

-- ---------------------------------------------------------------------------
-- 1. portfolios_public_read
--
-- is_public = TRUE olan portföylerin metadata'sı (ad, privacy_level, açıklama)
-- authenticated herkes tarafından görülebilir.
-- Kural: privacy_level burada filtre DEĞİL — allocation_only portföylerin adı
-- görünür ama positions/transactions tabloları kendi policy'leriyle gizlenir.
-- (001'deki tanımlama zaten doğruydu; idempotent re-CREATE.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "portfolios_public_read" ON portfolios;
CREATE POLICY "portfolios_public_read" ON portfolios
  FOR SELECT
  TO authenticated
  USING (
    is_public = TRUE
    AND auth.uid() IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 2. positions_public_read
--
-- Sadece privacy_level = 'full' olan public portföylerin pozisyonları görünür.
-- allocation_only → portföy adı görünür (portfolios_public_read) ama
--                   ticker/shares/avg_cost gizli kalır.
-- (002'deki güçlü form; idempotent re-CREATE.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "positions_public_read" ON positions;
CREATE POLICY "positions_public_read" ON positions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND portfolio_id IN (
      SELECT id FROM portfolios
      WHERE is_public = TRUE
        AND privacy_level = 'full'   -- allocation_only portföylerde raw pozisyon gizli
    )
  );

-- ---------------------------------------------------------------------------
-- 3. transactions_public_read
--
-- Sadece privacy_level = 'full' olan public portföylerin işlemleri görünür.
-- allocation_only → işlem detayları (fiyat, adet, tarih) gizli kalır.
-- (001'deki güçlü form; idempotent re-CREATE.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "transactions_public_read" ON transactions;
CREATE POLICY "transactions_public_read" ON transactions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND portfolio_id IN (
      SELECT id FROM portfolios
      WHERE is_public = TRUE
        AND privacy_level = 'full'   -- allocation_only portföylerde işlemler gizli
    )
  );

-- ---------------------------------------------------------------------------
-- 4. splits_public_read
--
-- Split geçmişi de transactions ile aynı kural: sadece privacy_level = 'full'.
-- (002'deki form; idempotent re-CREATE.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "splits_public_read" ON splits;
CREATE POLICY "splits_public_read" ON splits
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND portfolio_id IN (
      SELECT id FROM portfolios
      WHERE is_public = TRUE
        AND privacy_level = 'full'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. profiles_public_read  [YENİ — Faz 2 boşluk kapatma]
--
-- 001'de profiles tablosuna bio/avatar_emoji/is_profile_public eklendi ancak
-- bu sütunları okuyacak public SELECT policy yazılmadı.
--
-- Kural:
--   - is_profile_public = TRUE olan profiller authenticated herkes tarafından
--     username, display_name, bio, avatar_emoji sütunlarıyla okunabilir.
--   - is_profile_public = FALSE olan kullanıcılar sadece kendi satırlarını görür
--     (mevcut "profiles_select_own" / "profiles select" policy karşılar).
--   - parse_calls_today / parse_calls_date hassas sütunlar — RLS satır filtresi
--     yeterli; başka kullanıcının call sayısını görmek zararsız ama semantik
--     olarak owner-only. Sütun maskeleme (column-level security) ileride eklenebilir.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND is_profile_public = TRUE     -- kullanıcı profilini kamuya açmış olmalı
  );

-- ---------------------------------------------------------------------------
-- 6. follows_public_count  [YENİ — Faz 2 boşluk kapatma]
--
-- 001'deki follows_both_read: sadece follower_id = auth.uid() OR
-- following_id = auth.uid() — yani kendi takip ilişkilerin.
--
-- Sosyal profil sayfası başka bir kullanıcının takipçi/takip sayısını göstermek
-- için takip kayıtlarını sayabilmeli. Tam satır içeriği değil, sayım güvenli.
--
-- Kural: is_profile_public = TRUE olan kullanıcıların takip ilişkileri
-- (follower_id veya following_id) authenticated herkes tarafından SELECT edilebilir.
-- Bu policy yalnızca sayım/listeleme için; kimliği gizlemiş kullanıcılar zaten
-- is_profile_public = FALSE ayarlar → takip listesi de gizlenir.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "follows_public_count" ON follows;
CREATE POLICY "follows_public_count" ON follows
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    -- Her iki taraf da profilini public yapmış olmalı — OR kullanmak
    -- private kullanıcının UUID'sini sızdırır (rls-auditor MEDIUM bulgusu).
    AND follower_id  IN (SELECT user_id FROM profiles WHERE is_profile_public = TRUE)
    AND following_id IN (SELECT user_id FROM profiles WHERE is_profile_public = TRUE)
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (bu migration'ı geri almak için):
-- =============================================================================
--
-- BEGIN;
--
-- -- 1-4: public-read policy'leri 002'deki versiyonlarına döndür
-- --      (001/002 tanımlarını aşağıya kopyalayarak restore et)
--
-- DROP POLICY IF EXISTS "portfolios_public_read" ON portfolios;
-- CREATE POLICY "portfolios_public_read" ON portfolios
--   FOR SELECT
--   USING (is_public = TRUE AND auth.uid() IS NOT NULL);
--
-- DROP POLICY IF EXISTS "positions_public_read" ON positions;
-- CREATE POLICY "positions_public_read" ON positions
--   FOR SELECT
--   USING (
--     auth.uid() IS NOT NULL
--     AND portfolio_id IN (
--       SELECT id FROM portfolios
--       WHERE is_public = TRUE AND privacy_level = 'full'
--     )
--   );
--
-- DROP POLICY IF EXISTS "transactions_public_read" ON transactions;
-- CREATE POLICY "transactions_public_read" ON transactions
--   FOR SELECT
--   USING (
--     auth.uid() IS NOT NULL
--     AND portfolio_id IN (
--       SELECT id FROM portfolios
--       WHERE is_public = TRUE AND privacy_level = 'full'
--     )
--   );
--
-- DROP POLICY IF EXISTS "splits_public_read" ON splits;
-- CREATE POLICY "splits_public_read" ON splits
--   FOR SELECT
--   USING (
--     auth.uid() IS NOT NULL
--     AND portfolio_id IN (
--       SELECT id FROM portfolios
--       WHERE is_public = TRUE AND privacy_level = 'full'
--     )
--   );
--
-- -- 5-6: Faz 2'de eklenen YENİ policy'leri kaldır
-- DROP POLICY IF EXISTS "profiles_public_read"  ON profiles;
-- DROP POLICY IF EXISTS "follows_public_count"  ON follows;
--
-- COMMIT;

-- =============================================================================
-- DOĞRULAMA (migration sonrası SQL Editor'da çalıştır):
-- =============================================================================

-- 1. Tüm public-read policy'leri ve yeni Faz 2 policy'leri görünmeli
-- SELECT tablename, policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE policyname IN (
--   'portfolios_public_read',
--   'positions_public_read',
--   'transactions_public_read',
--   'splits_public_read',
--   'profiles_public_read',
--   'follows_public_count'
-- )
-- ORDER BY tablename, policyname;
-- -- Beklenen: 6 satır, hepsi cmd = 'SELECT', roles = '{authenticated}'

-- 2. profiles tablosunda public-read policy'si artık var olmalı
-- SELECT COUNT(*) FROM pg_policies
-- WHERE tablename = 'profiles' AND policyname = 'profiles_public_read';
-- -- Beklenen: 1

-- 3. follows tablosunda hem kendi-taraf hem public-count policy'si olmalı
-- SELECT policyname FROM pg_policies
-- WHERE tablename = 'follows'
-- ORDER BY policyname;
-- -- Beklenen: follows_both_read, follows_follower_delete, follows_follower_insert,
-- --           follows_public_count

-- 4. positions_public_read subquery'sinde privacy_level = 'full' koşulu doğrula
-- SELECT qual FROM pg_policies
-- WHERE tablename = 'positions' AND policyname = 'positions_public_read';
-- -- Beklenen: ... privacy_level = 'full' ...

-- 5. profiles_public_read USING koşulunu doğrula
-- SELECT qual FROM pg_policies
-- WHERE tablename = 'profiles' AND policyname = 'profiles_public_read';
-- -- Beklenen: ... is_profile_public = TRUE ...

-- 6. Toplam policy sayısı (002 sonrası + Faz 2 eklemeleri)
-- SELECT tablename, COUNT(*) AS policy_count
-- FROM pg_policies
-- WHERE tablename IN (
--   'portfolios', 'positions', 'transactions', 'splits',
--   'portfolio_activities', 'follows', 'profiles'
-- )
-- GROUP BY tablename
-- ORDER BY tablename;
-- -- Beklenen (002 + 004 toplamı):
-- --   follows              → 4  (follower_insert, follower_delete, both_read, public_count)
-- --   portfolio_activities → 3  (owner_insert, owner_delete, public_read)
-- --   portfolios           → 5  (owner_select/insert/update/delete, public_read)
-- --   positions            → 5  (select/insert/update/delete _own, public_read)
-- --   profiles             → 2+ (select_own veya benzeri mevcut + profiles_public_read)
-- --   splits               → 5  (select/insert/update/delete _own, public_read)
-- --   transactions         → 5  (select/insert/update/delete _own, public_read)
-- =============================================================================

-- =============================================================================
-- FRONTEND / EDGE FUNCTION NOTLARI:
-- =============================================================================
--
-- Bu migration SQL seviyesini hazırlar; UI aktivasyonu Social Faz 2 frontend
-- sprint'inde yapılacak:
--
--   1. portfolios tablosuna is_public toggle (Ayarlar / Portföy Yönetimi UI).
--   2. UserProfileModal — is_profile_public = TRUE kullanıcıları fetch eder
--      (profiles_public_read policy artık izin veriyor).
--   3. Public portföy görüntüleme sayfası — positions_public_read + privacy_level
--      gating UI tarafında da gösterilmeli ("Bu portföy sadece dağılım paylaşıyor"
--      warn-card allocation_only için).
--   4. Takipçi/takip sayısı — follows_public_count sayesinde COUNT sorgusu çalışır.
--   5. is_profile_public = FALSE ise profil gizli kalır; UI bu durumu handle etmeli
--      (404-benzeri "Bu profil gizli" mesajı).
-- =============================================================================
