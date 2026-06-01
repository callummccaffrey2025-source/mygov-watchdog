-- Verity Match engine — alignment scoring data foundation
-- Applied 2026-05-26
-- Tables: policy_issues, division_issue_tags, user_issue_stances
-- Depends on: divisions, division_votes, members (baseline schema)

-- ── policy_issues: the issues users take stances on ─────────────────────
CREATE TABLE IF NOT EXISTS policy_issues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  stance_question text NOT NULL,
  support_label text NOT NULL,
  oppose_label text NOT NULL,
  icon text,
  sort_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── division_issue_tags: AI/human classification of divisions → issues ──
CREATE TABLE IF NOT EXISTS division_issue_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  division_id text NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES policy_issues(id) ON DELETE CASCADE,
  aye_supports boolean NOT NULL,
  confidence real NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'ai',
  rationale text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(division_id, issue_id)
);

-- ── user_issue_stances: pre-auth user positions on issues ───────────────
CREATE TABLE IF NOT EXISTS user_issue_stances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL,
  user_id uuid,
  issue_id uuid NOT NULL REFERENCES policy_issues(id) ON DELETE CASCADE,
  stance smallint NOT NULL DEFAULT 0,
  importance smallint NOT NULL DEFAULT 2,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(device_id, issue_id)
);

-- Indexes for scoring queries
CREATE INDEX IF NOT EXISTS idx_division_issue_tags_issue ON division_issue_tags(issue_id);
CREATE INDEX IF NOT EXISTS idx_division_issue_tags_division ON division_issue_tags(division_id);
CREATE INDEX IF NOT EXISTS idx_division_issue_tags_confidence ON division_issue_tags(confidence) WHERE confidence >= 0.6;
CREATE INDEX IF NOT EXISTS idx_user_issue_stances_device ON user_issue_stances(device_id);
CREATE INDEX IF NOT EXISTS idx_user_issue_stances_user ON user_issue_stances(user_id) WHERE user_id IS NOT NULL;

-- ── Seed policy issues ──────────────────────────────────────────────────
INSERT INTO policy_issues (slug, name, stance_question, support_label, oppose_label, icon, sort_order) VALUES
  ('cost-of-living', 'Cost of Living', 'Should the government do more to reduce the cost of living?', 'More intervention', 'Market-led approach', '💰', 1),
  ('housing', 'Housing', 'Should the government increase housing supply and affordability measures?', 'More housing action', 'Less government involvement', '🏠', 2),
  ('climate', 'Climate & Energy', 'Should Australia take stronger action on climate change?', 'Stronger climate action', 'Prioritise energy affordability', '🌏', 3),
  ('aged-care', 'Aged Care', 'Should aged care funding be expanded?', 'Expand funding', 'Maintain current levels', '🏥', 4),
  ('immigration', 'Immigration', 'Should Australia increase immigration levels?', 'More immigration', 'Reduce immigration', '✈️', 5),
  ('tax', 'Tax & Budget', 'Should taxes be raised to fund more public services?', 'Higher taxes, more services', 'Lower taxes, smaller government', '📊', 6),
  ('health', 'Health', 'Should public healthcare funding be increased?', 'Increase health funding', 'Maintain current spending', '⚕️', 7),
  ('education', 'Education', 'Should government spending on education be increased?', 'More education funding', 'Current levels sufficient', '📚', 8),
  ('defence', 'Defence & Foreign Affairs', 'Should Australia increase defence spending?', 'Increase defence spending', 'Redirect to domestic priorities', '🛡️', 9),
  ('integrity', 'Integrity & Transparency', 'Should government transparency and anti-corruption measures be strengthened?', 'Stronger integrity measures', 'Current measures sufficient', '⚖️', 10)
ON CONFLICT (slug) DO NOTHING;

-- ── RLS policies ────────────────────────────────────────────────────────
ALTER TABLE policy_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_issue_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_issue_stances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_issues_read" ON policy_issues FOR SELECT USING (true);
CREATE POLICY "division_issue_tags_read" ON division_issue_tags FOR SELECT USING (true);
CREATE POLICY "user_issue_stances_read" ON user_issue_stances FOR SELECT USING (true);
CREATE POLICY "user_issue_stances_insert" ON user_issue_stances FOR INSERT WITH CHECK (true);
CREATE POLICY "user_issue_stances_update" ON user_issue_stances FOR UPDATE USING (true);

-- ── Update delete_user_data to include new tables ───────────────────────
CREATE OR REPLACE FUNCTION delete_user_data(target_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM user_issue_stances WHERE user_id = target_user_id;
  DELETE FROM user_interactions WHERE user_id = target_user_id;
  DELETE FROM user_follows WHERE user_id = target_user_id;
  DELETE FROM user_saves WHERE user_id = target_user_id;
  DELETE FROM relevance_cache WHERE profile_hash LIKE target_user_id::text || '%';
  DELETE FROM notification_preferences WHERE user_id = target_user_id;
  DELETE FROM push_tokens WHERE user_id = target_user_id;
  DELETE FROM user_preferences WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
