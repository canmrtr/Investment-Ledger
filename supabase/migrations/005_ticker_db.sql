-- Migration 005: ticker_db — SEC EDGAR US + Twelve Data BIST merged ticker listesi.
-- Haftalık pg_cron sync (fetch-fundamentals mode:"sync-ticker-db") ile beslenir.
-- Frontend SearchTab bu tabloyu doğrudan okur; edge function cold start ve
-- SEC EDGAR rate limit (10 req/s) sorunları ortadan kalkar.

CREATE TABLE IF NOT EXISTS ticker_db (
  ticker     TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  exchange   TEXT NOT NULL CHECK (exchange IN ('US', 'XIST')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE ticker_db ENABLE ROW LEVEL SECURITY;

-- Tüm authenticated kullanıcılar okuyabilir (public market reference data)
CREATE POLICY "ticker_db_read" ON ticker_db
  FOR SELECT TO authenticated USING (true);

-- Performans: name üzerinde gin index (full-text arama için hazırlık)
CREATE INDEX IF NOT EXISTS ticker_db_name_gin ON ticker_db
  USING gin (to_tsvector('simple', name));

-- Exchange index (US vs XIST filtresi için)
CREATE INDEX IF NOT EXISTS ticker_db_exchange_idx ON ticker_db (exchange);

-- pg_cron: Her Pazar 03:00 UTC sync
-- NOT: CRON_SECRET değerini kendi secret'ınızla değiştirin.
-- Supabase Dashboard → Settings → Edge Functions → Secrets → CRON_SECRET
SELECT cron.schedule(
  'sync-ticker-db-weekly',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url      := (SELECT value FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/fetch-fundamentals',
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body     := '{"mode":"sync-ticker-db"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id
  $$
);
