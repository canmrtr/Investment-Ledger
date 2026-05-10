-- 20260510_adr_bist_map.sql
-- OTC ADR ticker → BIST eşdeğeri lookup tablosu.
-- Read: anon + authenticated (public, hassas veri yok).
-- Write: service_role only (RLS policy yok = service_role bypass eder).
--        Supabase dashboard üzerinden manuel satır eklenebilir (service_role erişimi).

CREATE TABLE IF NOT EXISTS adr_bist_map (
  adr_ticker   TEXT PRIMARY KEY,
  bist_ticker  TEXT NOT NULL,
  name         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE adr_bist_map IS
  'Shared ADR→BIST ticker lookup. Written via service_role (dashboard / edge fn), read by anon+authenticated.';

ALTER TABLE adr_bist_map ENABLE ROW LEVEL SECURITY;

-- Public read: anon + authenticated (fund_cache / price_cache ile aynı pattern)
DROP POLICY IF EXISTS "adr_bist_map public read" ON adr_bist_map;
CREATE POLICY "adr_bist_map public read"
  ON adr_bist_map FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT / UPDATE / DELETE: policy yok → sadece service_role bypass ile erişim

-- Seed verisi
INSERT INTO adr_bist_map (adr_ticker, bist_ticker, name) VALUES
  ('ERELY', 'EREGL', 'Ereğli Demir Çelik'),
  ('TKCHY', 'THYAO', 'Türk Hava Yolları'),
  ('BKESY', 'BIMAS', 'BIM Birleşik Mağazalar')
ON CONFLICT (adr_ticker) DO NOTHING;
