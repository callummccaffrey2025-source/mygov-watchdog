-- Verified Participation Tables
-- Run via: supabase db push or paste into Supabase SQL editor
-- Polls, reactions, and discussions — all require verified (auth) users

-- ── Poll enhancements ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'poll_type') THEN
    ALTER TABLE polls ADD COLUMN poll_type text DEFAULT 'multiple_choice';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'related_bill_id') THEN
    ALTER TABLE polls ADD COLUMN related_bill_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'related_mp_id') THEN
    ALTER TABLE polls ADD COLUMN related_mp_id uuid;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  display_order int DEFAULT 0
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'poll_votes' AND column_name = 'user_id') THEN
    ALTER TABLE poll_votes ADD COLUMN user_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'poll_votes' AND column_name = 'electorate') THEN
    ALTER TABLE poll_votes ADD COLUMN electorate text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'poll_votes' AND column_name = 'postcode') THEN
    ALTER TABLE poll_votes ADD COLUMN postcode text;
  END IF;
END $$;

-- One vote per user per poll
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'poll_votes_user_poll_unique') THEN
    CREATE UNIQUE INDEX poll_votes_user_poll_unique ON poll_votes(poll_id, user_id) WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- ── Post reactions (verified users only) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  reaction_type text NOT NULL CHECK (reaction_type IN ('thumbs_up', 'thumbs_down')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- ── Discussions (electorate-scoped, verified users only) ─────────────────────

CREATE TABLE IF NOT EXISTS discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  electorate text NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  related_bill_id uuid,
  related_mp_id uuid,
  created_at timestamptz DEFAULT now(),
  is_pinned boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS discussion_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussions_electorate ON discussions(electorate);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_discussion ON discussion_comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id);

-- ── Poll results view ────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW poll_results AS
SELECT
  pv.poll_id,
  pv.option_index,
  pv.electorate,
  COUNT(*) as vote_count,
  COUNT(DISTINCT pv.user_id) as unique_voters
FROM poll_votes pv
WHERE pv.user_id IS NOT NULL
GROUP BY pv.poll_id, pv.option_index, pv.electorate;
