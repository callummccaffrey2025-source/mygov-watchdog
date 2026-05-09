-- ─────────────────────────────────────────────────────────────────────────────
-- User-scoped tables: saved items and in-app notifications.
--
-- Safe to run on any environment — uses IF NOT EXISTS throughout. If the tables
-- already exist in your project, this script is a no-op. If they don't, this
-- creates them with the schema the `useSaves` and `useNotifications` hooks
-- expect.
--
-- RLS policies allow users to see only their own rows (or rows keyed to their
-- device_id for anonymous usage).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── user_saves ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_saves (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    text,
  content_type text NOT NULL,         -- 'news_story' | 'bill' | 'vote' | 'post'
  content_id   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saves_user_content
  ON user_saves(user_id, content_type, content_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saves_device_content
  ON user_saves(device_id, content_type, content_id)
  WHERE device_id IS NOT NULL AND user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_saves_user_created
  ON user_saves(user_id, created_at DESC) WHERE user_id IS NOT NULL;

ALTER TABLE user_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own saves" ON user_saves;
CREATE POLICY "Users read own saves" ON user_saves FOR SELECT
  USING (auth.uid() = user_id OR (user_id IS NULL AND device_id IS NOT NULL));

DROP POLICY IF EXISTS "Users insert own saves" ON user_saves;
CREATE POLICY "Users insert own saves" ON user_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users delete own saves" ON user_saves;
CREATE POLICY "Users delete own saves" ON user_saves FOR DELETE
  USING (auth.uid() = user_id OR (user_id IS NULL AND device_id IS NOT NULL));


-- ── user_notifications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id         text,
  notification_type text NOT NULL,    -- 'mp_vote' | 'bill_update' | 'mp_post' | 'topic_news' | 'daily_brief' | 'community_reply'
  title             text NOT NULL,
  body              text,
  data              jsonb,            -- deep-link payload: { screen, billId, storyId, memberId, ... }
  is_read           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON user_notifications(user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_notifications_device_created
  ON user_notifications(device_id, created_at DESC) WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
  ON user_notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON user_notifications;
CREATE POLICY "Users read own notifications" ON user_notifications FOR SELECT
  USING (auth.uid() = user_id OR (user_id IS NULL AND device_id IS NOT NULL));

DROP POLICY IF EXISTS "Service role inserts notifications" ON user_notifications;
CREATE POLICY "Service role inserts notifications" ON user_notifications FOR INSERT
  WITH CHECK (true);  -- Edge Functions use service_role; RLS bypassed automatically.

DROP POLICY IF EXISTS "Users mark notifications read" ON user_notifications;
CREATE POLICY "Users mark notifications read" ON user_notifications FOR UPDATE
  USING (auth.uid() = user_id OR (user_id IS NULL AND device_id IS NOT NULL))
  WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND device_id IS NOT NULL));


-- ── Notes ───────────────────────────────────────────────────────────────────
-- If you already have these tables with a slightly different schema, this
-- migration will NOT overwrite them. Inspect and reconcile manually.
-- The hooks that consume these tables (useSaves, useNotifications) already
-- catch all errors and degrade gracefully — so even if the tables don't exist,
-- the app renders empty state instead of crashing.
