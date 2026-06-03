-- Civic Events + Vote Predictions + Representation Index
-- Applied 2026-05-26
-- Prompt 11: civic_events (longitudinal event log for Wrapped + aggregation)
-- Prompt 10: vote_predictions (The Mirror — guess-then-reveal)
-- Prompt 9:  representation_index RPC (MP electorate-alignment scoring)

-- ── Prompt 11: civic_events ─────────────────────────────────────────────
-- Lightweight longitudinal event log. Fire-and-forget from UI.
-- Substrate for future Wrapped and constituent-pressure aggregation.

CREATE TABLE IF NOT EXISTS civic_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL,
  user_id uuid,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_civic_events_device ON civic_events(device_id);
CREATE INDEX IF NOT EXISTS idx_civic_events_user ON civic_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_civic_events_type ON civic_events(event_type);
CREATE INDEX IF NOT EXISTS idx_civic_events_created ON civic_events(created_at DESC);

ALTER TABLE civic_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own events (device or user match)
CREATE POLICY "civic_events_select_own" ON civic_events FOR SELECT
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id'
    OR (user_id IS NOT NULL AND user_id = auth.uid()));

-- Anyone can insert (fire-and-forget; device_id validated client-side)
CREATE POLICY "civic_events_insert" ON civic_events FOR INSERT WITH CHECK (true);

-- Service role can read all for aggregation
CREATE POLICY "civic_events_service_all" ON civic_events FOR SELECT
  USING (current_setting('role', true) = 'service_role');


-- ── Prompt 10: vote_predictions (The Mirror) ────────────────────────────
-- Stores user guesses about how their MP voted on a division.
-- was_correct is set on reveal, not on insert.

CREATE TABLE IF NOT EXISTS vote_predictions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL,
  user_id uuid,
  division_id text NOT NULL,
  member_id uuid NOT NULL,
  guess text NOT NULL CHECK (guess IN ('aye', 'no', 'absent')),
  actual_vote text,
  was_correct boolean,
  revealed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(device_id, division_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_vote_predictions_device ON vote_predictions(device_id);
CREATE INDEX IF NOT EXISTS idx_vote_predictions_user ON vote_predictions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vote_predictions_member ON vote_predictions(member_id);

ALTER TABLE vote_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vote_predictions_select_own" ON vote_predictions FOR SELECT
  USING (true);
CREATE POLICY "vote_predictions_insert" ON vote_predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "vote_predictions_update_own" ON vote_predictions FOR UPDATE
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id'
    OR (user_id IS NOT NULL AND user_id = auth.uid()));


-- ── Prompt 9: Representation Index RPC ──────────────────────────────────
-- Computes per-MP alignment with their electorate's Verity poll sentiment.
-- Returns only MPs that clear MIN_SAMPLE and MIN_ISSUES thresholds.

CREATE OR REPLACE FUNCTION compute_representation_index(
  p_min_sample int DEFAULT 10,
  p_min_issues int DEFAULT 3
)
RETURNS TABLE (
  member_id uuid,
  member_name text,
  party text,
  electorate text,
  electorate_id uuid,
  photo_url text,
  alignment_score numeric,
  issues_covered int,
  sample_size int,
  rank int,
  total_ranked int,
  contributing_issues jsonb
) AS $$
WITH
-- Step 1: Get electorate-level stance aggregation from user_issue_stances
-- Join stances -> user_preferences (for electorate) -> electorates
electorate_stances AS (
  SELECT
    up.electorate_id,
    uis.issue_id,
    pi.slug AS issue_slug,
    pi.name AS issue_name,
    -- Majority position: average stance > 0 means "support", < 0 means "oppose"
    AVG(uis.stance) AS avg_stance,
    COUNT(DISTINCT uis.device_id) AS respondent_count
  FROM user_issue_stances uis
  JOIN user_preferences up ON up.device_id = uis.device_id
  JOIN policy_issues pi ON pi.id = uis.issue_id
  WHERE up.electorate_id IS NOT NULL
    AND pi.active = true
  GROUP BY up.electorate_id, uis.issue_id, pi.slug, pi.name
  HAVING COUNT(DISTINCT uis.device_id) >= p_min_sample
),

-- Step 2: Derive each MP's lean per issue from division_votes + division_issue_tags
mp_issue_leans AS (
  SELECT
    m.id AS member_id,
    dit.issue_id,
    -- MP's effective stance: proportion of tagged divisions where they voted WITH the issue
    AVG(CASE
      WHEN (dit.aye_supports = true AND dv.vote_cast = 'aye') THEN 1.0
      WHEN (dit.aye_supports = true AND dv.vote_cast = 'no') THEN -1.0
      WHEN (dit.aye_supports = false AND dv.vote_cast = 'no') THEN 1.0
      WHEN (dit.aye_supports = false AND dv.vote_cast = 'aye') THEN -1.0
      ELSE 0
    END) AS mp_lean,
    COUNT(*) AS vote_count
  FROM division_votes dv
  JOIN division_issue_tags dit ON dit.division_id = dv.division_id
  JOIN members m ON m.id = dv.member_id
  WHERE dit.confidence >= 0.6
    AND dv.vote_cast IN ('aye', 'no')
  GROUP BY m.id, dit.issue_id
),

-- Step 3: Match MP lean vs electorate majority per issue
mp_electorate_alignment AS (
  SELECT
    m.id AS member_id,
    m.first_name || ' ' || m.last_name AS member_name,
    COALESCE(p.abbreviation, p.name, 'IND') AS party,
    e.name AS electorate,
    m.electorate_id,
    m.photo_url,
    es.issue_id,
    es.issue_slug,
    es.issue_name,
    es.avg_stance AS electorate_stance,
    mil.mp_lean,
    es.respondent_count,
    CASE WHEN SIGN(es.avg_stance) = SIGN(mil.mp_lean) THEN 1 ELSE 0 END AS is_aligned
  FROM members m
  JOIN mp_issue_leans mil ON mil.member_id = m.id
  JOIN electorate_stances es ON es.electorate_id = m.electorate_id AND es.issue_id = mil.issue_id
  LEFT JOIN electorates e ON e.id = m.electorate_id
  LEFT JOIN parties p ON p.id = m.party_id
  WHERE m.is_active = true
    AND m.chamber = 'house'
),

-- Step 4: Aggregate per MP
mp_scores AS (
  SELECT
    member_id,
    member_name,
    party,
    electorate,
    electorate_id,
    photo_url,
    ROUND(AVG(is_aligned) * 100, 1) AS alignment_score,
    COUNT(DISTINCT issue_id) AS issues_covered,
    MIN(respondent_count)::int AS sample_size,
    jsonb_agg(jsonb_build_object(
      'issue_slug', issue_slug,
      'issue_name', issue_name,
      'electorate_stance', ROUND(electorate_stance::numeric, 2),
      'mp_lean', ROUND(mp_lean::numeric, 2),
      'aligned', is_aligned = 1,
      'respondents', respondent_count
    ) ORDER BY issue_slug) AS contributing_issues
  FROM mp_electorate_alignment
  GROUP BY member_id, member_name, party, electorate, electorate_id, photo_url
  HAVING COUNT(DISTINCT issue_id) >= p_min_issues
)

SELECT
  ms.member_id,
  ms.member_name,
  ms.party,
  ms.electorate,
  ms.electorate_id,
  ms.photo_url,
  ms.alignment_score,
  ms.issues_covered,
  ms.sample_size,
  (ROW_NUMBER() OVER (ORDER BY ms.alignment_score DESC))::int AS rank,
  (COUNT(*) OVER ())::int AS total_ranked,
  ms.contributing_issues
FROM mp_scores ms
ORDER BY ms.alignment_score DESC;
$$ LANGUAGE sql STABLE;


-- ── Update delete_user_data to include new tables ───────────────────────
CREATE OR REPLACE FUNCTION delete_user_data(target_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM civic_events WHERE user_id = target_user_id;
  DELETE FROM vote_predictions WHERE user_id = target_user_id;
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
