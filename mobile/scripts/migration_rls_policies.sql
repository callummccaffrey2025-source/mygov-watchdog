-- Row Level Security Policies for Verity
-- Run via Supabase SQL editor
-- Principle: public data is readable by all, user data is private

-- ── Enable RLS on all tables ─────────────────────────────────────────────────

ALTER TABLE IF EXISTS user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS community_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS share_events ENABLE ROW LEVEL SECURITY;

-- ── Public read tables (no RLS needed — all data is public) ──────────────────
-- members, bills, divisions, division_votes, parties, electorates,
-- news_articles, news_stories, news_sources, official_posts,
-- daily_briefs, bill_arguments, party_policies, hansard_speeches,
-- polls, councils, councillors, state_members, state_bills

-- ── User preferences: users can only read/write their own ────────────────────

CREATE POLICY IF NOT EXISTS "Users read own prefs" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id OR device_id = current_setting('request.headers', true)::json->>'x-device-id');

CREATE POLICY IF NOT EXISTS "Users write own prefs" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY IF NOT EXISTS "Users update own prefs" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ── Follows: users see own, can insert/delete own ────────────────────────────

CREATE POLICY IF NOT EXISTS "Users read own follows" ON user_follows
  FOR SELECT USING (auth.uid() = user_id OR (user_id IS NULL AND device_id IS NOT NULL));

CREATE POLICY IF NOT EXISTS "Users insert follows" ON user_follows
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY IF NOT EXISTS "Users delete own follows" ON user_follows
  FOR DELETE USING (auth.uid() = user_id);

-- ── Saves: users see own, can insert/delete own ─────────────────────────────

CREATE POLICY IF NOT EXISTS "Users read own saves" ON user_saves
  FOR SELECT USING (auth.uid() = user_id OR (user_id IS NULL AND device_id IS NOT NULL));

CREATE POLICY IF NOT EXISTS "Users insert saves" ON user_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY IF NOT EXISTS "Users delete own saves" ON user_saves
  FOR DELETE USING (auth.uid() = user_id);

-- ── Notification preferences: own only ───────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users read own notif prefs" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users write own notif prefs" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ── Push tokens: own only ────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users manage own tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- ── Community posts: public read, authenticated write ────────────────────────

CREATE POLICY IF NOT EXISTS "Anyone reads posts" ON community_posts
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Auth users create posts" ON community_posts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR device_id IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Users delete own posts" ON community_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ── Community comments: public read, authenticated write ─────────────────────

CREATE POLICY IF NOT EXISTS "Anyone reads comments" ON community_comments
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Auth users create comments" ON community_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR device_id IS NOT NULL);

-- ── Community votes: own only ────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users read own votes" ON community_votes
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users insert votes" ON community_votes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR device_id IS NOT NULL);

-- ── Reactions: public read (counts), authenticated write ─────────────────────

CREATE POLICY IF NOT EXISTS "Anyone reads reactions" ON reactions
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Auth users react" ON reactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Users update own reactions" ON reactions
  FOR UPDATE USING (auth.uid() = user_id);

-- ── Poll votes: authenticated users only ─────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Anyone reads poll votes" ON poll_votes
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Auth users vote" ON poll_votes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── MP messages: users see own ───────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users read own messages" ON mp_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users send messages" ON mp_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ── Share events: insert only (analytics) ────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Anyone logs shares" ON share_events
  FOR INSERT WITH CHECK (true);
