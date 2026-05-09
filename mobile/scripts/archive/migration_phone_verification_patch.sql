-- ═══════════════════════════════════════════════════════════════════════════
-- PHONE VERIFICATION PATCH — adds missing columns to existing tables
-- ═══════════════════════════════════════════════════════════════════════════
-- The tables exist from a prior migration but are missing columns needed
-- by the Twilio Verify Edge Functions. This patch adds them.
--
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/zmmglikiryuftqmoprqm/sql

-- ── phone_verifications: add missing columns ────────────────────────────

ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS verification_sid text;
ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '5 minutes');

-- Backfill status for existing rows
UPDATE phone_verifications SET status = 'verified' WHERE verified_at IS NOT NULL AND status IS NULL;
UPDATE phone_verifications SET status = 'pending' WHERE verified_at IS NULL AND status IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_phone_verif_user_status ON phone_verifications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verif_hash ON phone_verifications(phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verif_ip ON phone_verifications(ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verif_expires ON phone_verifications(expires_at) WHERE status = 'pending';

-- RLS
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own verifications"
    ON phone_verifications FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access verifications"
    ON phone_verifications FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── verification_audit_log: add missing columns ─────────────────────────

ALTER TABLE verification_audit_log ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE verification_audit_log ADD COLUMN IF NOT EXISTS phone_hash text;
ALTER TABLE verification_audit_log ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE verification_audit_log ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Check what columns it currently has and add user_id if missing
ALTER TABLE verification_audit_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE verification_audit_log ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_verif_audit_user ON verification_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verif_audit_action ON verification_audit_log(action, created_at DESC);

ALTER TABLE verification_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service only audit log"
    ON verification_audit_log FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── user_preferences: add missing columns ───────────────────────────────

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS phone_hash text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS verification_tier text DEFAULT 'tier_0';

-- Partial unique index: one phone per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_phone_hash_unique
  ON user_preferences(phone_hash) WHERE phone_hash IS NOT NULL;

-- ── email_domain_blocklist ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_domain_blocklist (
  domain text PRIMARY KEY,
  reason text DEFAULT 'disposable',
  added_at timestamptz DEFAULT now()
);

INSERT INTO email_domain_blocklist (domain, reason) VALUES
  ('guerrillamail.com', 'disposable'), ('mailinator.com', 'disposable'),
  ('tempmail.com', 'disposable'), ('throwaway.email', 'disposable'),
  ('yopmail.com', 'disposable'), ('10minutemail.com', 'disposable'),
  ('trashmail.com', 'disposable'), ('sharklasers.com', 'disposable'),
  ('dispostable.com', 'disposable'), ('maildrop.cc', 'disposable'),
  ('getnada.com', 'disposable'), ('temp-mail.org', 'disposable'),
  ('fakeinbox.com', 'disposable'), ('burnermail.io', 'disposable'),
  ('tmail.gg', 'disposable'), ('tmpmail.net', 'disposable')
ON CONFLICT (domain) DO NOTHING;

-- ── Verify everything worked ─────────────────────────────────────────────

DO $$ BEGIN
  RAISE NOTICE 'Migration patch complete. Run this to verify:';
  RAISE NOTICE '  SELECT column_name FROM information_schema.columns WHERE table_name = ''phone_verifications'' ORDER BY ordinal_position;';
END $$;
