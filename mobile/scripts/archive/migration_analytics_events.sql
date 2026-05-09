-- Analytics events table
-- Lightweight event tracking for Verity usage analytics

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  device_id text,
  event_name text NOT NULL,
  event_data jsonb DEFAULT '{}',
  screen_name text,
  created_at timestamptz DEFAULT now()
);

-- Index for querying by event name and time
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name, created_at DESC);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Index for querying by device
CREATE INDEX IF NOT EXISTS idx_analytics_device ON analytics_events(device_id, created_at DESC) WHERE device_id IS NOT NULL;

-- Auto-delete events older than 90 days (run via pg_cron)
-- SELECT cron.schedule('cleanup_analytics', '0 3 * * *', $$DELETE FROM analytics_events WHERE created_at < now() - interval '90 days'$$);
