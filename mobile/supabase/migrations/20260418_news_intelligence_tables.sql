-- News Intelligence Tables
-- Applied to dev branch (azvwzfsnzopeyzxzexto) on 2026-04-18
-- Supports: entity extraction, primary source linking, contradictions, morning signal

CREATE TABLE IF NOT EXISTS story_entities (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id      integer NOT NULL,
  entity_type   text NOT NULL CHECK (entity_type IN ('member', 'bill', 'party', 'quote')),
  entity_value  text NOT NULL,
  member_id     uuid,
  bill_id       uuid,
  confidence    real NOT NULL DEFAULT 0.0,
  raw_mention   text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(story_id, entity_type, entity_value)
);
CREATE INDEX IF NOT EXISTS idx_story_entities_story ON story_entities(story_id);
CREATE INDEX IF NOT EXISTS idx_story_entities_member ON story_entities(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_story_entities_bill ON story_entities(bill_id) WHERE bill_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS story_primary_sources (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id      integer NOT NULL,
  source_type   text NOT NULL CHECK (source_type IN ('hansard', 'division_vote', 'bill', 'donation')),
  source_id     text NOT NULL,
  member_id     uuid,
  relevance     real NOT NULL DEFAULT 0.0,
  excerpt       text,
  metadata      jsonb,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(story_id, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_story_sources_story ON story_primary_sources(story_id);
CREATE INDEX IF NOT EXISTS idx_story_sources_member ON story_primary_sources(member_id) WHERE member_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mp_contradictions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id       uuid NOT NULL,
  story_id        integer,
  claim_text      text NOT NULL,
  claim_source    text,
  claim_date      date NOT NULL,
  contra_type     text NOT NULL CHECK (contra_type IN ('hansard', 'division_vote', 'previous_quote')),
  contra_source_id text NOT NULL,
  contra_text     text NOT NULL,
  contra_date     date NOT NULL,
  confidence      real NOT NULL DEFAULT 0.0,
  ai_explanation  text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  created_at      timestamptz DEFAULT now(),
  reviewed_at     timestamptz,
  UNIQUE(member_id, claim_text, contra_source_id)
);
CREATE INDEX IF NOT EXISTS idx_contradictions_member ON mp_contradictions(member_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_status ON mp_contradictions(status);
CREATE INDEX IF NOT EXISTS idx_contradictions_confidence ON mp_contradictions(confidence DESC);

CREATE TABLE IF NOT EXISTS morning_signals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date            date NOT NULL,
  electorate      text NOT NULL DEFAULT '__national__',
  top_stories     jsonb NOT NULL,
  shifted_positions jsonb,
  bill_movements  jsonb,
  blindspot       jsonb,
  electorate_impact text,
  generation_model text DEFAULT 'claude-haiku-4-5-20251001',
  generation_cost  real,
  token_count     integer,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(date, electorate)
);
CREATE INDEX IF NOT EXISTS idx_morning_signals_date ON morning_signals(date DESC);

CREATE TABLE IF NOT EXISTS entity_extraction_runs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz,
  stories_processed integer DEFAULT 0,
  entities_found    integer DEFAULT 0,
  sources_linked    integer DEFAULT 0,
  contradictions_found integer DEFAULT 0,
  tokens_used       integer DEFAULT 0,
  cost_usd          real DEFAULT 0.0,
  error             text
);
