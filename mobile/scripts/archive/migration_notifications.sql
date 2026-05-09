-- Verity Notification System — Database Migration
-- Run against the Supabase SQL editor or via: psql $DATABASE_URL -f migration_notifications.sql
--
-- Tables:
--   notification_log       — server-side log of all sent push notifications (analytics)
--   user_notifications     — per-user in-app notification feed (ActivityScreen)
--   push_tokens            — Expo push tokens per user/device
--   notification_preferences — per-user toggles for notification types
--
-- Note: push_tokens and notification_preferences likely already exist.
-- This migration uses CREATE TABLE IF NOT EXISTS and is safe to re-run.

-- ── notification_log ─────────────────────────────────────────────────────────
-- Server-side log of every push notification batch sent.
-- Written by daily-mp-notification, bill-change-notify, parliament-sitting-alert Edge Functions.
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type text NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}',
  recipients integer DEFAULT 0,
  sent_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_member ON notification_log(member_id);

-- ── user_notifications ───────────────────────────────────────────────────────
-- Per-user notification feed for the in-app ActivityScreen.
-- Written by Edge Functions after sending push notifications.
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  device_id text,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_notifications_identity CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(user_id, is_read) WHERE NOT is_read;

-- RLS: users can only read/update their own notifications
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users read own notifications"
  ON user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users mark own notifications read"
  ON user_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert (Edge Functions write notifications)
CREATE POLICY IF NOT EXISTS "Service role inserts notifications"
  ON user_notifications FOR INSERT
  WITH CHECK (true);

-- ── push_tokens ──────────────────────────────────────────────────────────────
-- Expo push tokens per user/device. Upserted on every app open.
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  token text NOT NULL,
  platform text DEFAULT 'ios',
  postcode text,
  electorate text,
  member_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_member ON push_tokens(member_id);

-- RLS: users manage their own tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users manage own tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service role manages all tokens"
  ON push_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── notification_preferences ─────────────────────────────────────────────────
-- Per-user toggles for notification types.
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  daily_brief boolean DEFAULT true,
  new_bills boolean DEFAULT true,
  mp_votes boolean DEFAULT true,
  breaking_news boolean DEFAULT true,
  election_updates boolean DEFAULT true,
  local_announcements boolean DEFAULT true,
  weekly_summary boolean DEFAULT false,
  email_digest_enabled boolean DEFAULT true,
  email_digest_last_sent timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: users manage their own preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── error_reports ────────────────────────────────────────────────────────────
-- Client-side error reports from lib/errorReporting.ts
CREATE TABLE IF NOT EXISTS error_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  error_message text NOT NULL,
  error_stack text,
  component_stack text,
  screen_name text,
  app_version text,
  platform text,
  severity text DEFAULT 'error',
  extra jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_reports_created ON error_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_reports_severity ON error_reports(severity);

-- ── Cleanup: auto-delete old notifications after 30 days ─────────────────────
-- Optional: schedule via pg_cron
-- SELECT cron.schedule('cleanup-old-notifications', '0 3 * * 0',
--   $$DELETE FROM user_notifications WHERE created_at < now() - interval '30 days'$$
-- );
-- SELECT cron.schedule('cleanup-old-notification-log', '0 3 * * 0',
--   $$DELETE FROM notification_log WHERE sent_at < now() - interval '90 days'$$
-- );
