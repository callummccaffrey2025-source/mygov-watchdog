-- ═══════════════════════════════════════════════════════════════════════════
-- DAILY POLLS REBUILD — One poll per day, AI-generated with guardrails
-- ═══════════════════════════════════════════════════════════════════════════
-- Run in Supabase SQL Editor

-- ── Archive existing polls ───────────────────────────────────────────────
-- Keep the old tables but mark all existing polls as archived so they
-- don't show in the new UI

ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS status text DEFAULT 'published';
UPDATE verity_polls SET status = 'archived' WHERE status IS NULL OR status = 'published';

-- ── New daily_polls table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  publish_date date NOT NULL UNIQUE,
  question text NOT NULL,
  option_a_text text NOT NULL,
  option_b_text text NOT NULL,
  skip_text text DEFAULT 'Not sure',
  source_article_url text NOT NULL,
  source_article_title text,
  source_article_outlet text,
  source_article_published_at timestamptz,
  ai_generation_metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',  -- draft, published, withdrawn
  withdrawn_reason text,
  withdrawn_at timestamptz,
  withdrawn_by uuid,
  published_at timestamptz,
  resolves_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Only one poll per date, enforce at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_polls_date ON daily_polls(publish_date);
CREATE INDEX IF NOT EXISTS idx_daily_polls_status ON daily_polls(status, publish_date DESC);

-- ── Poll responses table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_poll_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL REFERENCES daily_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_chosen text NOT NULL CHECK (option_chosen IN ('a', 'b', 'skip')),
  vote_weight real DEFAULT 1.0,
  trust_factors jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_poll_resp_poll ON daily_poll_responses(poll_id, option_chosen);
CREATE INDEX IF NOT EXISTS idx_daily_poll_resp_user ON daily_poll_responses(user_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE daily_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_poll_responses ENABLE ROW LEVEL SECURITY;

-- Polls: public read for published and withdrawn
DO $$ BEGIN
  CREATE POLICY "Public read published polls"
    ON daily_polls FOR SELECT
    USING (status IN ('published', 'withdrawn'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service full access polls"
    ON daily_polls FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Responses: users read their own, aggregates are public via views
DO $$ BEGIN
  CREATE POLICY "Users read own responses"
    ON daily_poll_responses FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own responses"
    ON daily_poll_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service full access responses"
    ON daily_poll_responses FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Aggregate view (public) ──────────────────────────────────────────────

CREATE OR REPLACE VIEW daily_poll_results AS
SELECT
  poll_id,
  option_chosen,
  COUNT(*) AS response_count,
  SUM(vote_weight) AS weighted_count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY poll_id), 0) * 100, 1) AS percentage
FROM daily_poll_responses
GROUP BY poll_id, option_chosen;
