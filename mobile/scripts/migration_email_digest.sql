-- Weekly email digest preferences

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_digest_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_digest_last_sent timestamptz;

-- Index for quick filtering in the digest job
CREATE INDEX IF NOT EXISTS idx_notif_prefs_digest
  ON notification_preferences(email_digest_enabled)
  WHERE email_digest_enabled = true;

-- ── Log table for sent digests ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  sent_at timestamptz DEFAULT now(),
  status text DEFAULT 'sent',
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_email_digest_log_user ON email_digest_log(user_id, sent_at DESC);

-- Schedule weekly at 6pm AEST Sunday (8am UTC Sunday)
-- SELECT cron.schedule(
--   'weekly-digest',
--   '0 8 * * 0',
--   $$SELECT net.http_post(
--     url := 'https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/weekly-digest',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   )$$
-- );
