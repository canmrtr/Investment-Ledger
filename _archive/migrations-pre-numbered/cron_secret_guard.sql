-- =============================================================================
-- Migration: cron_secret_guard
-- Purpose:   Replace the anon Bearer token in the refresh-price-cache-6h
--            pg_cron job with a dedicated CRON_SECRET value.
-- Date:      2026-04-27
-- =============================================================================
--
-- BEFORE RUNNING:
--   1. Generate a strong secret (e.g. `openssl rand -base64 32`).
--   2. Add it as a Supabase Edge Function secret named CRON_SECRET:
--        Supabase Dashboard → Project Settings → Edge Functions → Secrets
--        Key:   CRON_SECRET
--        Value: <your-generated-secret>
--   3. Update your edge function (refresh-price-cache) to validate the header:
--        const cronSecret = Deno.env.get("CRON_SECRET");
--        const authHeader  = req.headers.get("Authorization") ?? "";
--        if (authHeader !== `Bearer ${cronSecret}`) {
--          return new Response("Unauthorized", { status: 401 });
--        }
--   4. Replace every occurrence of <CRON_SECRET_VALUE> below with the actual
--      secret value before pasting into the Supabase SQL editor.
--      *** Do NOT commit the real secret to source control. ***
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Step 1: Remove the existing cron job safely
-- -----------------------------------------------------------------------------
-- cron.unschedule returns TRUE if the job existed, FALSE if it was already gone.
-- This is safe to run even if the job does not exist yet.
SELECT cron.unschedule('refresh-price-cache-6h');


-- -----------------------------------------------------------------------------
-- Step 2: Recreate the job with the CRON_SECRET authorization header
-- -----------------------------------------------------------------------------
-- Replace <CRON_SECRET_VALUE> with your actual secret before running.
-- The header value must match exactly what Deno.env.get("CRON_SECRET") returns
-- in the edge function.
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'refresh-price-cache-6h',          -- job name (unchanged)
  '0 */6 * * *',                     -- every 6 hours
  $$
  SELECT pg_net.http_post(
    url     := 'https://jfetubcilmuthpddkodg.supabase.co/functions/v1/refresh-price-cache',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CRON_SECRET_VALUE>'   -- ← REPLACE THIS
    ),
    body    := '{}'::jsonb
  );
  $$
);


-- =============================================================================
-- Verification
-- =============================================================================
-- Run this after the migration to confirm the job is registered and has run:
--
-- SELECT
--   j.jobname,
--   j.schedule,
--   j.command,
--   r.status,
--   r.start_time,
--   r.end_time,
--   r.return_message
-- FROM cron.job j
-- LEFT JOIN cron.job_run_details r ON r.jobid = j.jobid
-- WHERE j.jobname = 'refresh-price-cache-6h'
-- ORDER BY r.start_time DESC
-- LIMIT 5;
--
-- Expected: one row in cron.job with the new command containing CRON_SECRET.
-- =============================================================================


-- =============================================================================
-- Rollback
-- =============================================================================
-- To revert to the old anon-key header, run:
--
-- SELECT cron.unschedule('refresh-price-cache-6h');
--
-- SELECT cron.schedule(
--   'refresh-price-cache-6h',
--   '0 */6 * * *',
--   $$
--   SELECT pg_net.http_post(
--     url     := 'https://jfetubcilmuthpddkodg.supabase.co/functions/v1/refresh-price-cache',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer <ANON_KEY>'    -- ← paste your anon key here
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
-- =============================================================================
