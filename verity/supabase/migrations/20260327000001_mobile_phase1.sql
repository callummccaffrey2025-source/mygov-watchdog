-- ============================================================
-- Verity Mobile Phase 1 — additive migration
-- Extends existing tables and adds new mobile-only tables.
-- Safe to run alongside the existing web schema.
-- ============================================================

-- ── Extend: parties ──────────────────────────────────────────────────────────

ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS short_name  text,
  ADD COLUMN IF NOT EXISTS colour      text,
  ADD COLUMN IF NOT EXISTS logo_url    text,
  ADD COLUMN IF NOT EXISTS level       text NOT NULL DEFAULT 'federal',
  ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now();

-- Backfill short_name from the existing 'short' column
UPDATE parties SET short_name = short WHERE short_name IS NULL AND short IS NOT NULL;

-- ── Extend: electorates ──────────────────────────────────────────────────────

ALTER TABLE electorates
  ADD COLUMN IF NOT EXISTS level      text NOT NULL DEFAULT 'federal',
  ADD COLUMN IF NOT EXISTS postcodes  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_electorates_postcodes ON electorates USING GIN (postcodes);
CREATE INDEX IF NOT EXISTS idx_electorates_state     ON electorates (state);

-- ── New: members ─────────────────────────────────────────────────────────────
-- Richer than the existing `mps` table; used by the mobile app.

CREATE TABLE IF NOT EXISTS members (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name       text        NOT NULL,
  last_name        text        NOT NULL,
  party_id         uuid        REFERENCES parties(id) ON DELETE SET NULL,
  electorate_id    uuid        REFERENCES electorates(id) ON DELETE SET NULL,
  chamber          text        NOT NULL,
  level            text        NOT NULL DEFAULT 'federal',
  role             text,
  photo_url        text,
  email            text,
  phone            text,
  social_twitter   text,
  social_facebook  text,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_electorate_id ON members (electorate_id);
CREATE INDEX IF NOT EXISTS idx_members_party_id      ON members (party_id);
CREATE INDEX IF NOT EXISTS idx_members_level         ON members (level, is_active);

-- ── Extend: bills ────────────────────────────────────────────────────────────

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS short_title       text,
  ADD COLUMN IF NOT EXISTS summary_raw       text,
  ADD COLUMN IF NOT EXISTS summary_plain     text,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'introduced',
  ADD COLUMN IF NOT EXISTS chamber_introduced text,
  ADD COLUMN IF NOT EXISTS level             text NOT NULL DEFAULT 'federal',
  ADD COLUMN IF NOT EXISTS state             text,
  ADD COLUMN IF NOT EXISTS last_updated      date,
  ADD COLUMN IF NOT EXISTS categories        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at        timestamptz NOT NULL DEFAULT now();

-- Backfill from existing columns where safe
UPDATE bills
SET
  summary_raw       = COALESCE(summary_raw, summary),
  chamber_introduced = COALESCE(chamber_introduced, chamber),
  last_updated      = COALESCE(last_updated, introduced)
WHERE summary_raw IS NULL OR chamber_introduced IS NULL;

CREATE INDEX IF NOT EXISTS idx_bills_level_status ON bills (level, status);
CREATE INDEX IF NOT EXISTS idx_bills_categories   ON bills USING GIN (categories);

-- ── New: party_policies ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS party_policies (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id       uuid        NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  category       text        NOT NULL CHECK (category IN (
                               'housing','healthcare','economy','climate',
                               'immigration','defence','education','cost_of_living'
                             )),
  summary_plain  text        NOT NULL,
  source_url     text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, category)
);

-- ── New: bill_arguments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bill_arguments (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id        uuid  NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  side           text  NOT NULL CHECK (side IN ('for','against')),
  argument_text  text  NOT NULL,
  source         text
);

CREATE INDEX IF NOT EXISTS idx_bill_arguments_bill_id ON bill_arguments (bill_id);

-- ── New: member_votes ────────────────────────────────────────────────────────
-- Named member_votes to avoid conflict with the existing `votes` (divisions) table.

CREATE TABLE IF NOT EXISTS member_votes (
  id         uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  bill_id    uuid  NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  vote       text  NOT NULL CHECK (vote IN ('aye','no','absent','abstain')),
  date       date  NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, bill_id)
);

CREATE INDEX IF NOT EXISTS idx_member_votes_member_id ON member_votes (member_id);
CREATE INDEX IF NOT EXISTS idx_member_votes_bill_id   ON member_votes (bill_id);

-- ── New: polls ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS polls (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question       text        NOT NULL,
  bill_id        uuid        REFERENCES bills(id) ON DELETE SET NULL,
  options        jsonb       NOT NULL DEFAULT '[]',
  electorate_id  uuid        REFERENCES electorates(id) ON DELETE SET NULL,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz
);

-- ── New: poll_votes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_votes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      uuid        NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer     NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

-- ── New: reactions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reactions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type  text        NOT NULL CHECK (target_type IN ('bill','post','announcement')),
  target_id    uuid        NOT NULL,
  reaction     text        NOT NULL CHECK (reaction IN ('like','dislike')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_target ON reactions (target_type, target_id);

-- ── New: announcements ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS announcements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  body            text        NOT NULL,
  category        text        NOT NULL CHECK (category IN ('infrastructure','policy','budget','community')),
  level           text        NOT NULL CHECK (level IN ('federal','state','local')),
  state           text,
  electorate_id   uuid        REFERENCES electorates(id) ON DELETE SET NULL,
  source_url      text,
  published_date  date        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_electorate_id ON announcements (electorate_id);
CREATE INDEX IF NOT EXISTS idx_announcements_level         ON announcements (level);

-- ── Extend: user_preferences ─────────────────────────────────────────────────

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS postcode              text,
  ADD COLUMN IF NOT EXISTS electorate_id         uuid REFERENCES electorates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS followed_members      uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS followed_parties      uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS followed_topics       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at            timestamptz NOT NULL DEFAULT now();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_votes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Public read on all reference / civic data
CREATE POLICY "public read members"        ON members        FOR SELECT USING (true);
CREATE POLICY "public read party_policies" ON party_policies FOR SELECT USING (true);
CREATE POLICY "public read bill_arguments" ON bill_arguments FOR SELECT USING (true);
CREATE POLICY "public read member_votes"   ON member_votes   FOR SELECT USING (true);
CREATE POLICY "public read polls"          ON polls          FOR SELECT USING (true);
CREATE POLICY "public read announcements"  ON announcements  FOR SELECT USING (true);

-- poll_votes: each user can only see and insert their own vote
CREATE POLICY "auth insert poll_votes"     ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth read own poll_votes"   ON poll_votes FOR SELECT USING (auth.uid() = user_id);

-- reactions: anyone can read, auth user can insert/delete their own
CREATE POLICY "public read reactions"      ON reactions FOR SELECT USING (true);
CREATE POLICY "auth insert reactions"      ON reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth delete own reactions"  ON reactions FOR DELETE USING (auth.uid() = user_id);
