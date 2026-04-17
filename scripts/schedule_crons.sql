-- Verity automated pipeline cron jobs
-- Run this once in the Supabase SQL Editor.
--
-- Prerequisites:
-- 1. Enable pg_cron and pg_net extensions (Dashboard → Database → Extensions)
-- 2. Set the following database parameters (run in SQL Editor):
--
--    ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';
--    ALTER DATABASE postgres SET app.supabase_url = 'https://zmmglikiryuftqmoprqm.supabase.co';
--
-- Find your service role key in: Dashboard → Project Settings → API → service_role (secret)

-- 6am AEST (UTC+10) = 20:00 UTC — fetch news from RSS feeds and cluster into stories
SELECT cron.schedule(
  'ingest-news-daily',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/ingest-news',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 7am AEST (UTC+10) = 21:00 UTC — generate today's daily brief from top stories + recent divisions
SELECT cron.schedule(
  'generate-daily-brief',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To verify cron jobs are registered:
-- SELECT * FROM cron.job;

-- To check recent run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- To check pipeline audit logs:
-- SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 20;

-- To remove a job if needed:
-- SELECT cron.unschedule('ingest-news-daily');
-- SELECT cron.unschedule('generate-daily-brief');
