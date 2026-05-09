-- ═══════════════════════════════════════════════════════════════════════════
-- VERITY POLL INTEGRITY INFRASTRUCTURE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Layered defence against poll manipulation:
--   L1: Account verification (email, phone, disposable blocking)
--   L2: Device/IP fingerprinting
--   L3: Behavioural anomaly detection
--   L4: Postcode verification tiers
--   L5: Trust-weighted voting
--   L6: Transparent methodology
--   L7: Full audit trail
--
-- Run: supabase db execute --project-ref zmmglikiryuftqmoprqm < scripts/migration_poll_integrity.sql

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE A1 — IDENTITY AND VERIFICATION SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════

-- Extend user_preferences with verification state
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS phone_number_hash text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS phone_carrier_type text; -- mobile, landline, voip, unknown
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS postcode_trust_level text; -- declared, geolocation_confirmed, document_verified
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS postcode_verified_at timestamptz;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS device_fingerprint text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS signup_ip_hash text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS signup_ip_country text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS signup_proxy_detected boolean DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS trust_score real DEFAULT 0.2;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS trust_score_updated_at timestamptz;

-- Unique constraint: one phone per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_phone_hash
  ON user_preferences(phone_number_hash) WHERE phone_number_hash IS NOT NULL;

-- ── Poll Vote Audit ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_vote_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL,
  user_id uuid NOT NULL,
  option_id uuid,
  vote_weight real DEFAULT 1.0,
  trust_factors jsonb DEFAULT '{}',
  ip_hash text,
  device_fingerprint text,
  created_at timestamptz DEFAULT now(),
  flagged_reason text,
  excluded_from_tally boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_poll_vote_audit_poll ON poll_vote_audit(poll_id, excluded_from_tally);
CREATE INDEX IF NOT EXISTS idx_poll_vote_audit_user ON poll_vote_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_vote_audit_ip ON poll_vote_audit(ip_hash, poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_vote_audit_device ON poll_vote_audit(device_fingerprint, poll_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_vote_audit_unique ON poll_vote_audit(poll_id, user_id);

-- ── Account Creation Signals ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_creation_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ip_hash text,
  ip_country text,
  proxy_detected boolean DEFAULT false,
  voip_phone boolean DEFAULT false,
  disposable_email boolean DEFAULT false,
  device_fingerprint text,
  accounts_from_same_ip_24h integer DEFAULT 0,
  accounts_from_same_device_ever integer DEFAULT 0,
  risk_score real DEFAULT 0.0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creation_signals_user ON account_creation_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_creation_signals_ip ON account_creation_signals(ip_hash);
CREATE INDEX IF NOT EXISTS idx_creation_signals_device ON account_creation_signals(device_fingerprint);

-- ── Email Domain Blocklist ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_domain_blocklist (
  domain text PRIMARY KEY,
  reason text DEFAULT 'disposable',
  added_at timestamptz DEFAULT now()
);

-- Seed with known disposable email providers
INSERT INTO email_domain_blocklist (domain, reason) VALUES
  ('guerrillamail.com', 'disposable'), ('guerrillamail.de', 'disposable'),
  ('mailinator.com', 'disposable'), ('tempmail.com', 'disposable'),
  ('throwaway.email', 'disposable'), ('yopmail.com', 'disposable'),
  ('10minutemail.com', 'disposable'), ('trashmail.com', 'disposable'),
  ('sharklasers.com', 'disposable'), ('grr.la', 'disposable'),
  ('dispostable.com', 'disposable'), ('maildrop.cc', 'disposable'),
  ('getnada.com', 'disposable'), ('temp-mail.org', 'disposable'),
  ('fakeinbox.com', 'disposable'), ('emailondeck.com', 'disposable'),
  ('mohmal.com', 'disposable'), ('burnermail.io', 'disposable'),
  ('mailnesia.com', 'disposable'), ('harakirimail.com', 'disposable'),
  ('crazymailing.com', 'disposable'), ('tempail.com', 'disposable'),
  ('tempr.email', 'disposable'), ('tmail.gg', 'disposable'),
  ('luxusmail.org', 'disposable'), ('tmpmail.net', 'disposable')
ON CONFLICT (domain) DO NOTHING;

-- ── Poll Corrections Log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_corrections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL,
  correction_type text NOT NULL, -- 'exclude_votes', 'recompute', 'manual_note'
  votes_affected integer DEFAULT 0,
  rule_applied text, -- e.g. 'ip_hash duplicates', 'trust_score < 0.1'
  notes text,
  corrected_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

-- ── Poll Methodology Metadata ────────────────────────────────────────────
-- Extends verity_polls with methodology fields

ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS methodology_note text;
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS min_votes_to_publish integer DEFAULT 50;
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS cooldown_hours integer DEFAULT 6;
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS results_published boolean DEFAULT false;
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS brigade_detected boolean DEFAULT false;
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS brigade_note text;
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS weighted_results jsonb; -- cached weighted tally
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS raw_results jsonb;     -- cached unweighted tally
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS trust_rating integer;  -- 1-5 stars
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS target_electorate text;
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS target_state text;
ALTER TABLE verity_polls ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_verity_polls_slug ON verity_polls(slug) WHERE slug IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE A1 — ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE poll_vote_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_creation_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_domain_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_corrections ENABLE ROW LEVEL SECURITY;

-- poll_vote_audit: users see their own (non-sensitive fields only via view)
DO $$ BEGIN
  CREATE POLICY "Users see own audit" ON poll_vote_audit
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role full access
DO $$ BEGIN
  CREATE POLICY "Service full access audit" ON poll_vote_audit
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- account_creation_signals: admin only (service role)
DO $$ BEGIN
  CREATE POLICY "Service only creation signals" ON account_creation_signals
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- email_domain_blocklist: public read, admin write
DO $$ BEGIN
  CREATE POLICY "Blocklist public read" ON email_domain_blocklist
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Blocklist service write" ON email_domain_blocklist
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- poll_corrections: admin only
DO $$ BEGIN
  CREATE POLICY "Service only corrections" ON poll_corrections
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE A3 — TRUST SCORE AND VOTE WEIGHTING FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Compute trust score for a user (0.0 to 1.0)
CREATE OR REPLACE FUNCTION compute_trust_score(p_user_id uuid)
RETURNS real AS $$
DECLARE
  score real := 0.0;
  prefs record;
  acct_age interval;
  interaction_count integer;
  signals record;
BEGIN
  -- Get user preferences
  SELECT * INTO prefs FROM user_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN 0.1; END IF;

  -- Email verified: +0.1
  IF prefs.email_verified_at IS NOT NULL THEN
    score := score + 0.1;
  END IF;

  -- Phone verified: +0.2 (mobile) or +0.05 (voip)
  IF prefs.phone_verified_at IS NOT NULL THEN
    IF prefs.phone_carrier_type = 'voip' THEN
      score := score + 0.05;
    ELSE
      score := score + 0.2;
    END IF;
  END IF;

  -- Account age
  SELECT (now() - u.created_at) INTO acct_age
  FROM auth.users u WHERE u.id = p_user_id;

  IF acct_age IS NOT NULL THEN
    IF acct_age > interval '180 days' THEN
      score := score + 0.25;
    ELSIF acct_age > interval '30 days' THEN
      score := score + 0.15;
    END IF;
  END IF;

  -- Postcode trust level
  IF prefs.postcode_trust_level = 'document_verified' THEN
    score := score + 0.25;
  ELSIF prefs.postcode_trust_level = 'geolocation_confirmed' THEN
    score := score + 0.15;
  ELSIF prefs.postcode_trust_level = 'declared' THEN
    score := score + 0.05;
  END IF;

  -- Meaningful interactions (bill reads, MP follows, votes, claims)
  SELECT COUNT(*) INTO interaction_count FROM (
    SELECT id FROM user_reads WHERE user_id = p_user_id
    UNION ALL
    SELECT id FROM user_follows WHERE user_id = p_user_id
    UNION ALL
    SELECT id FROM poll_votes WHERE user_id = p_user_id
    UNION ALL
    SELECT id FROM user_saves WHERE user_id = p_user_id
  ) combined;

  IF interaction_count >= 100 THEN
    score := score + 0.25;
  ELSIF interaction_count >= 20 THEN
    score := score + 0.15;
  END IF;

  -- Clean signup (no proxy, no voip, no disposable)
  SELECT * INTO signals FROM account_creation_signals WHERE user_id = p_user_id;
  IF FOUND AND NOT signals.proxy_detected AND NOT signals.voip_phone AND NOT signals.disposable_email THEN
    score := score + 0.1;
  END IF;

  -- Cap at 1.0
  RETURN LEAST(score, 1.0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Weight a specific vote on a specific poll
CREATE OR REPLACE FUNCTION weight_poll_vote(p_user_id uuid, p_poll_id uuid)
RETURNS real AS $$
DECLARE
  base_weight real;
  poll record;
  prefs record;
  acct_age interval;
  interaction_count integer;
  ip text;
  device text;
  ip_dupe_count integer;
  device_dupe_count integer;
BEGIN
  -- Base = trust score
  base_weight := compute_trust_score(p_user_id);

  -- Get poll targeting
  SELECT * INTO poll FROM verity_polls WHERE id = p_poll_id;

  -- Get user preferences for location check
  SELECT * INTO prefs FROM user_preferences WHERE user_id = p_user_id;

  -- Postcode-restricted polls: out-of-region votes get 0.1
  IF poll.target_state IS NOT NULL AND prefs.state IS DISTINCT FROM poll.target_state THEN
    base_weight := LEAST(base_weight, 0.1);
  END IF;
  IF poll.target_electorate IS NOT NULL AND prefs.electorate IS DISTINCT FROM poll.target_electorate THEN
    base_weight := LEAST(base_weight, 0.1);
  END IF;

  -- Behavioural anomaly: voted within 60s of account creation with no engagement
  SELECT (now() - u.created_at) INTO acct_age FROM auth.users u WHERE u.id = p_user_id;
  IF acct_age IS NOT NULL AND acct_age < interval '60 seconds' THEN
    SELECT COUNT(*) INTO interaction_count FROM user_reads WHERE user_id = p_user_id;
    IF interaction_count = 0 THEN
      base_weight := LEAST(base_weight, 0.1);
    END IF;
  END IF;

  -- IP/device duplicate detection: same IP or device already voted on this poll
  SELECT signup_ip_hash, device_fingerprint INTO ip, device
  FROM user_preferences WHERE user_id = p_user_id;

  IF ip IS NOT NULL THEN
    SELECT COUNT(*) INTO ip_dupe_count
    FROM poll_vote_audit
    WHERE poll_id = p_poll_id AND ip_hash = ip AND user_id != p_user_id AND NOT excluded_from_tally;
    IF ip_dupe_count > 0 THEN
      base_weight := 0.0; -- Duplicate IP on same poll
    END IF;
  END IF;

  IF device IS NOT NULL THEN
    SELECT COUNT(*) INTO device_dupe_count
    FROM poll_vote_audit
    WHERE poll_id = p_poll_id AND device_fingerprint = device AND user_id != p_user_id AND NOT excluded_from_tally;
    IF device_dupe_count > 0 THEN
      base_weight := 0.0; -- Duplicate device on same poll
    END IF;
  END IF;

  RETURN GREATEST(base_weight, 0.0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE A5 — RETROACTIVE CLEANUP FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

-- Exclude flagged votes and recompute tally
CREATE OR REPLACE FUNCTION cleanup_poll_votes(
  p_poll_id uuid,
  p_rule text,       -- e.g. 'trust_score < 0.1', 'ip_duplicates'
  p_corrected_by text DEFAULT 'admin'
)
RETURNS integer AS $$
DECLARE
  affected integer := 0;
BEGIN
  -- Mark matching votes as excluded
  IF p_rule = 'trust_score_below_threshold' THEN
    UPDATE poll_vote_audit
    SET excluded_from_tally = true, flagged_reason = 'trust_score below threshold'
    WHERE poll_id = p_poll_id
      AND NOT excluded_from_tally
      AND (trust_factors->>'trust_score')::real < 0.15;
    GET DIAGNOSTICS affected = ROW_COUNT;

  ELSIF p_rule = 'ip_duplicates' THEN
    -- Exclude all but the first vote per IP
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY ip_hash ORDER BY created_at ASC) AS rn
      FROM poll_vote_audit
      WHERE poll_id = p_poll_id AND ip_hash IS NOT NULL AND NOT excluded_from_tally
    )
    UPDATE poll_vote_audit a
    SET excluded_from_tally = true, flagged_reason = 'duplicate IP'
    FROM ranked r
    WHERE a.id = r.id AND r.rn > 1;
    GET DIAGNOSTICS affected = ROW_COUNT;

  ELSIF p_rule = 'device_duplicates' THEN
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY device_fingerprint ORDER BY created_at ASC) AS rn
      FROM poll_vote_audit
      WHERE poll_id = p_poll_id AND device_fingerprint IS NOT NULL AND NOT excluded_from_tally
    )
    UPDATE poll_vote_audit a
    SET excluded_from_tally = true, flagged_reason = 'duplicate device'
    FROM ranked r
    WHERE a.id = r.id AND r.rn > 1;
    GET DIAGNOSTICS affected = ROW_COUNT;

  ELSIF p_rule = 'new_account_burst' THEN
    -- Exclude votes from accounts < 1 hour old with no prior engagement
    UPDATE poll_vote_audit pva
    SET excluded_from_tally = true, flagged_reason = 'new account burst'
    WHERE pva.poll_id = p_poll_id
      AND NOT pva.excluded_from_tally
      AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = pva.user_id
          AND (pva.created_at - u.created_at) < interval '1 hour'
      )
      AND (pva.trust_factors->>'interaction_count')::int < 5;
    GET DIAGNOSTICS affected = ROW_COUNT;
  END IF;

  -- Log the correction
  INSERT INTO poll_corrections (poll_id, correction_type, votes_affected, rule_applied, corrected_by)
  VALUES (p_poll_id, 'exclude_votes', affected, p_rule, p_corrected_by);

  RETURN affected;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE A4 — POLL SLUG GENERATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-generate slugs for polls
UPDATE verity_polls
SET slug = left(
  regexp_replace(
    regexp_replace(
      regexp_replace(lower(trim(title)), '[^a-z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  ),
  60
)
WHERE slug IS NULL;
