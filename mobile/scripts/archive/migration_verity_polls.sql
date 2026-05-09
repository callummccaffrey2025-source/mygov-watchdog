-- Verity Polls — Database Migration
-- Run against the Supabase SQL editor:
--   supabase db execute --project-ref zmmglikiryuftqmoprqm < scripts/migration_verity_polls.sql
--
-- A verified citizen polling platform. Every vote tied to a real electorate.

-- ── Core tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS verity_polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  question text NOT NULL,
  description text,
  poll_type text NOT NULL DEFAULT 'single_choice',
  category text DEFAULT 'national',
  related_bill_id uuid,
  related_member_id uuid,
  topic text,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  total_votes integer DEFAULT 0,
  opens_at timestamptz DEFAULT now(),
  closes_at timestamptz,
  created_by text DEFAULT 'verity',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  country text DEFAULT 'AU'
);

CREATE TABLE IF NOT EXISTS poll_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES verity_polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  vote_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES verity_polls(id) ON DELETE CASCADE,
  option_id uuid REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  electorate text,
  postcode text,
  state text,
  country text DEFAULT 'AU',
  voted_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verity_polls_featured ON verity_polls(is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_verity_polls_active ON verity_polls(is_active, closes_at);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id, display_order);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id, option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id, poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_electorate ON poll_votes(poll_id, electorate);
CREATE INDEX IF NOT EXISTS idx_poll_votes_state ON poll_votes(poll_id, state);

-- ── Views for fast result aggregation ────────────────────────────────────────

CREATE OR REPLACE VIEW poll_results_national AS
SELECT
  pv.poll_id,
  po.label AS option_label,
  po.id AS option_id,
  COUNT(*) AS vote_count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY pv.poll_id), 0) * 100, 1) AS percentage
FROM poll_votes pv
JOIN poll_options po ON po.id = pv.option_id
GROUP BY pv.poll_id, po.label, po.id;

CREATE OR REPLACE VIEW poll_results_by_state AS
SELECT
  pv.poll_id,
  po.label AS option_label,
  po.id AS option_id,
  pv.state,
  COUNT(*) AS vote_count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY pv.poll_id, pv.state), 0) * 100, 1) AS percentage
FROM poll_votes pv
JOIN poll_options po ON po.id = pv.option_id
WHERE pv.state IS NOT NULL
GROUP BY pv.poll_id, po.label, po.id, pv.state;

CREATE OR REPLACE VIEW poll_results_by_electorate AS
SELECT
  pv.poll_id,
  po.label AS option_label,
  po.id AS option_id,
  pv.electorate,
  pv.state,
  COUNT(*) AS vote_count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY pv.poll_id, pv.electorate), 0) * 100, 1) AS percentage
FROM poll_votes pv
JOIN poll_options po ON po.id = pv.option_id
WHERE pv.electorate IS NOT NULL
GROUP BY pv.poll_id, po.label, po.id, pv.electorate, pv.state;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE verity_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls and options: publicly readable
DO $$ BEGIN
  CREATE POLICY "Polls publicly readable" ON verity_polls FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Options publicly readable" ON poll_options FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Votes: readable for aggregation, users can insert their own
DO $$ BEGIN
  CREATE POLICY "Votes publicly readable" ON poll_votes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can vote" ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role can do anything (for Edge Functions)
DO $$ BEGIN
  CREATE POLICY "Service role full access polls" ON verity_polls FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access options" ON poll_options FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access votes" ON poll_votes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Trigger: auto-update total_votes on verity_polls ─────────────────────────

CREATE OR REPLACE FUNCTION update_poll_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update option vote count
  UPDATE poll_options SET vote_count = (
    SELECT COUNT(*) FROM poll_votes WHERE option_id = NEW.option_id
  ) WHERE id = NEW.option_id;

  -- Update poll total votes
  UPDATE verity_polls SET total_votes = (
    SELECT COUNT(*) FROM poll_votes WHERE poll_id = NEW.poll_id
  ), updated_at = now() WHERE id = NEW.poll_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_poll_vote_counts ON poll_votes;
CREATE TRIGGER trg_update_poll_vote_counts
  AFTER INSERT ON poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_vote_counts();

-- ── Seed initial polls ───────────────────────────────────────────────────────

INSERT INTO verity_polls (title, question, description, topic, is_featured, closes_at)
VALUES
  ('Nuclear Energy', 'Should Australia invest in nuclear power plants?',
   'The Coalition has proposed building 7 nuclear power stations across Australia. Labor opposes the plan, citing cost and timeline concerns.',
   'energy', true, now() + interval '7 days'),
  ('Housing Crisis', 'What is the most effective solution to Australia''s housing crisis?',
   'Housing affordability is the #1 issue for Australians under 40. What approach do you support?',
   'housing', false, now() + interval '7 days'),
  ('Cost of Living', 'Are you better or worse off financially compared to 12 months ago?',
   'With interest rates, grocery prices, and energy costs all rising, how has your household been affected?',
   'economy', false, now() + interval '7 days')
ON CONFLICT DO NOTHING;

-- Nuclear Energy options
INSERT INTO poll_options (poll_id, label, display_order)
SELECT id, label, ord FROM verity_polls
CROSS JOIN (VALUES
  ('Yes — Australia needs nuclear energy', 0),
  ('No — invest in renewables instead', 1),
  ('Unsure — need more information', 2)
) AS opts(label, ord)
WHERE title = 'Nuclear Energy'
AND NOT EXISTS (SELECT 1 FROM poll_options WHERE poll_id = verity_polls.id);

-- Housing Crisis options
INSERT INTO poll_options (poll_id, label, display_order)
SELECT id, label, ord FROM verity_polls
CROSS JOIN (VALUES
  ('Build more public housing', 0),
  ('Restrict foreign investment in housing', 1),
  ('Reform negative gearing and CGT', 2),
  ('Increase immigration restrictions', 3),
  ('Let the market sort it out', 4)
) AS opts(label, ord)
WHERE title = 'Housing Crisis'
AND NOT EXISTS (SELECT 1 FROM poll_options WHERE poll_id = verity_polls.id);

-- Cost of Living options
INSERT INTO poll_options (poll_id, label, display_order)
SELECT id, label, ord FROM verity_polls
CROSS JOIN (VALUES
  ('Much worse off', 0),
  ('Somewhat worse off', 1),
  ('About the same', 2),
  ('Somewhat better off', 3),
  ('Much better off', 4)
) AS opts(label, ord)
WHERE title = 'Cost of Living'
AND NOT EXISTS (SELECT 1 FROM poll_options WHERE poll_id = verity_polls.id);
