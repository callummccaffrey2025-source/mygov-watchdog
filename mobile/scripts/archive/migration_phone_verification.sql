-- ═══════════════════════════════════════════════════════════════════════════
-- PHONE VERIFICATION — Tier 0 → Tier 1
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Twilio Verify is the OTP source of truth. We don't generate or store
-- OTPs locally. This schema tracks verification attempts, enforces rate
-- limits, and maintains the audit trail.
--
-- Run: supabase db execute --project-ref zmmglikiryuftqmoprqm < scripts/migration_phone_verification.sql

-- ── Extend user_preferences with phone verification fields ───────────────

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS phone_hash text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS verification_tier text DEFAULT 'tier_0';

-- Partial unique index: one phone per account, enforced at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_phone_hash_unique
  ON user_preferences(phone_hash) WHERE phone_hash IS NOT NULL;

-- ── Phone verifications table ────────────────────────────────────────────
-- Tracks each OTP send attempt. Twilio Verify is the OTP source of truth.

CREATE TABLE IF NOT EXISTS phone_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_hash text NOT NULL,
  user_id uuid NOT NULL,
  verification_sid text,           -- Twilio Verification SID
  status text DEFAULT 'pending',   -- pending, verified, expired, max_attempts
  attempt_count integer DEFAULT 0, -- confirm attempts (max 5)
  ip_hash text,
  expires_at timestamptz NOT NULL, -- now() + 5 minutes
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verif_user ON phone_verifications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verif_hash ON phone_verifications(phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verif_ip ON phone_verifications(ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verif_expires ON phone_verifications(expires_at) WHERE status = 'pending';

-- RLS: users can read their own rows (for resumable flow check on mount)
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

-- ── Verification audit log ───────────────────────────────────────────────
-- Never contains raw phone numbers. Uses phone_hash only.

CREATE TABLE IF NOT EXISTS verification_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,  -- otp_sent, otp_verified, otp_failed, otp_expired, phone_already_claimed, rate_limited, twilio_error
  phone_hash text,
  ip_hash text,
  metadata jsonb DEFAULT '{}',  -- { twilio_status, twilio_sid, attempts_remaining, error_code, http_status }
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verif_audit_user ON verification_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verif_audit_action ON verification_audit_log(action, created_at DESC);

ALTER TABLE verification_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log: service role only (contains forensic data)
DO $$ BEGIN
  CREATE POLICY "Service only audit log"
    ON verification_audit_log FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Hourly cleanup: mark expired pending rows ────────────────────────────
-- Schedule via pg_cron:
--   SELECT cron.schedule('expire-phone-verifications', '0 * * * *',
--     $$UPDATE phone_verifications SET status = 'expired' WHERE status = 'pending' AND expires_at < now()$$
--   );

-- Run once now to clean any existing stale rows
UPDATE phone_verifications SET status = 'expired' WHERE status = 'pending' AND expires_at < now();
