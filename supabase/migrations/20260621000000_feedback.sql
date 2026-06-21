-- Sprint 28 #2 — In-app Support & Feature Request channel.
-- Kullanıcılar uygulama içinden hata bildirir / özellik talep eder. Veri in-house
-- (Supabase), üçüncü-parti yok. RLS: kullanıcı yalnız KENDİ feedback'ini insert + select
-- eder; UPDATE/DELETE yok (immutable kayıt — kullanıcı gönderdikten sonra değiştiremez,
-- moderasyon/admin görünümü ileride service_role ile).
-- Hardening: 002_rls_fixes.sql standardına uy — `auth.uid() IS NOT NULL` guard + BEGIN/COMMIT.

BEGIN;

CREATE TABLE IF NOT EXISTS public.feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('bug', 'feature')),
  message    text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- own-select performansı + admin sıralaması için.
CREATE INDEX IF NOT EXISTS feedback_user_created_idx ON public.feedback (user_id, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- INSERT: yalnız kendi satırı. user_id default auth.uid() olsa da WITH CHECK ile zorla
-- (client yanlış/başka user_id gönderse bile reddedilir).
CREATE POLICY "feedback_insert_own" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- SELECT: yalnız kendi feedback'i. (Admin görünümü ileride service_role ile RLS bypass.)
CREATE POLICY "feedback_select_own" ON public.feedback
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- UPDATE/DELETE policy YOK → RLS default-deny: kullanıcı kaydı değiştiremez/silemez (immutable).

-- Grant hardening: Supabase default privileges public şemada yeni tablolara anon+authenticated'a
-- TÜM yetkileri (UPDATE/DELETE/TRUNCATE dahil) otomatik verir → RLS bugün bloklar ama latent risk
-- (ileride bir UPDATE/DELETE policy eklenirse grant zaten açık olur). Least-privilege: sıfırla,
-- yalnız gerekeni geri ver. (rls-empirical-tester 2026-06-21 önerisi.)
REVOKE ALL ON public.feedback FROM anon, authenticated;
GRANT SELECT, INSERT ON public.feedback TO authenticated;

COMMIT;
