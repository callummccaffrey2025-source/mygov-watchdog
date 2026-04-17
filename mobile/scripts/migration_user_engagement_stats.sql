-- Daily user engagement stats
-- One row per user per day — enables streak tracking, Verity Wrapped, leaderboards

CREATE TABLE IF NOT EXISTS user_engagement_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stat_date date NOT NULL,
  bills_read int DEFAULT 0,
  mp_profiles_viewed int DEFAULT 0,
  news_stories_read int DEFAULT 0,
  discussions_posted int DEFAULT 0,
  polls_voted int DEFAULT 0,
  share_cards_created int DEFAULT 0,
  time_spent_seconds int DEFAULT 0,
  streak_days int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_engagement_stats_user ON user_engagement_stats(user_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_stats_date ON user_engagement_stats(stat_date DESC);

ALTER TABLE user_engagement_stats ENABLE ROW LEVEL SECURITY;

-- Users read their own stats
CREATE POLICY IF NOT EXISTS "Users read own engagement stats" ON user_engagement_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Only the track-engagement edge function (service role) writes
-- No client-side write policy — all writes go through the edge function

-- ── Aggregated view for leaderboards (no user_id exposed) ────────────────────

CREATE OR REPLACE VIEW electorate_engagement_leaderboard AS
SELECT
  up.electorate,
  COUNT(DISTINCT ues.user_id) as active_users,
  SUM(ues.bills_read) as total_bills_read,
  SUM(ues.news_stories_read) as total_news_read,
  SUM(ues.polls_voted) as total_poll_votes,
  SUM(ues.discussions_posted) as total_discussions
FROM user_engagement_stats ues
JOIN user_preferences up ON up.user_id = ues.user_id
WHERE ues.stat_date >= current_date - interval '30 days'
  AND up.electorate IS NOT NULL
GROUP BY up.electorate;
