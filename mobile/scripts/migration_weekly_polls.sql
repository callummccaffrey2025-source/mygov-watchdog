-- Weekly Poll System
-- One national question per week tied to current news

CREATE TABLE IF NOT EXISTS weekly_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  description text,
  options jsonb NOT NULL DEFAULT '[]',  -- array of option strings
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES weekly_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_selected int NOT NULL,
  postcode text,
  electorate text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_polls_active ON weekly_polls(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_weekly_poll_votes_poll ON weekly_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_weekly_poll_votes_electorate ON weekly_poll_votes(poll_id, electorate);

-- ── Seed a sample poll (remove after testing) ────────────────────────────────

INSERT INTO weekly_polls (question, description, options, starts_at, ends_at)
VALUES (
  'Should Australia lower the voting age to 16?',
  'Several European countries allow 16-year-olds to vote in local elections. Should Australia follow?',
  '["Yes, lower it to 16", "No, keep it at 18", "Lower to 17 as a compromise", "Undecided"]'::jsonb,
  now(),
  now() + interval '7 days'
)
ON CONFLICT DO NOTHING;

-- ── Results view for easy querying ───────────────────────────────────────────

CREATE OR REPLACE VIEW weekly_poll_results AS
SELECT
  wpv.poll_id,
  wpv.option_selected,
  wpv.electorate,
  COUNT(*) as vote_count
FROM weekly_poll_votes wpv
GROUP BY wpv.poll_id, wpv.option_selected, wpv.electorate;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE weekly_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_poll_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read polls
CREATE POLICY IF NOT EXISTS "Anyone reads weekly polls" ON weekly_polls FOR SELECT USING (true);

-- Anyone can read votes (for results)
CREATE POLICY IF NOT EXISTS "Anyone reads weekly poll votes" ON weekly_poll_votes FOR SELECT USING (true);

-- Only authenticated users can vote
CREATE POLICY IF NOT EXISTS "Auth users vote on weekly polls" ON weekly_poll_votes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
