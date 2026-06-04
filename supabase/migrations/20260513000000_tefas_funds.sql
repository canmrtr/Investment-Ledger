-- 20260513000000_tefas_funds.sql
-- TEFAS yatırım fonu kataloğu (kod → isim → kategori) lookup tablosu.
-- Read: anon + authenticated (public, hassas veri yok — paylaşımlı katalog).
-- Write: service_role only (fetch-fundamentals mode:"tefas-catalog"; RLS policy yok = service_role bypass eder).
--        ~3500 fon; haftalık/manuel yeniden yüklenir.

CREATE TABLE IF NOT EXISTS tefas_funds (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tefas_funds IS
  'Shared TEFAS mutual fund catalog. Written via service_role (fetch-fundamentals tefas-catalog), read by anon+authenticated.';

ALTER TABLE tefas_funds ENABLE ROW LEVEL SECURITY;

-- Public read: anon + authenticated (adr_bist_map / fund_cache / price_cache ile aynı pattern)
DROP POLICY IF EXISTS "tefas_funds public read" ON tefas_funds;
CREATE POLICY "tefas_funds public read"
  ON tefas_funds FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT / UPDATE / DELETE: policy yok → sadece service_role bypass ile erişim
