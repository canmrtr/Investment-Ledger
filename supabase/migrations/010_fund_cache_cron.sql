-- Migration 010: fund_cache refresh — pg_cron haftalık job.
-- Her Pazar 03:30 UTC (sync-ticker-db-weekly 03:00 UTC ile çakışmasın diye 30dk sonra).
-- fetch-fundamentals mode:"refresh-fund-cache" ile stale fund_cache kayıtları yenilenir.

SELECT cron.schedule(
  'refresh-fund-cache-weekly',
  '30 3 * * 0',
  $$
  SELECT net.http_post(
    url      := (SELECT value FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL')
                 || '/functions/v1/fetch-fundamentals',
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body     := '{"mode":"refresh-fund-cache"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id
  $$
);
