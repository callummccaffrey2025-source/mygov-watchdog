-- Notification log table
-- Records every push notification sent for auditing and analytics

CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,  -- 'mp_vote', 'mp_speech', 'mp_absent', 'daily_brief', 'bill_update', 'breaking'
  member_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  recipients int DEFAULT 0,
  sent_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_member ON notification_log(member_id, sent_at DESC) WHERE member_id IS NOT NULL;

-- Schedule the daily MP notification at 7am AEST (9pm UTC)
-- Run this AFTER deploying the edge function:
--
-- SELECT cron.schedule(
--   'daily-mp-notification',
--   '0 21 * * *',
--   $$SELECT net.http_post(
--     url := 'https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/daily-mp-notification',
--     body := '{}'::jsonb,
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
--       'Content-Type', 'application/json'
--     )
--   )$$
-- );
