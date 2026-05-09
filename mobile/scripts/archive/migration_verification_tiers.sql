-- Verity Identity & Trust — Verification Tier Infrastructure
-- Applied: 2026-04-29
--
-- Three migrations applied via Supabase MCP:
-- 1. verification_tier_on_user_preferences
-- 2. extend_members_parties_electorates
-- 3. verification_infrastructure_tables
--
-- This file is a consolidated local copy for version control.
-- DO NOT re-run — these have already been applied to production.

-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 1: Verification tier on user_preferences
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS verification_tier text DEFAULT 'tier_0';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS id_verified_at timestamptz;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS verification_provider text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS verification_reference_id text;

DO $$ BEGIN
  ALTER TABLE user_preferences ADD CONSTRAINT chk_verification_tier
    CHECK (verification_tier IN ('tier_0', 'tier_1', 'tier_2', 'politician'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_user_prefs_tier ON user_preferences(verification_tier);

-- SECURITY DEFINER function: only path to tier changes
CREATE OR REPLACE FUNCTION upgrade_user_tier(
  target_user_id uuid, new_tier text,
  provider text DEFAULT NULL, reference_id text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF new_tier NOT IN ('tier_0', 'tier_1', 'tier_2', 'politician') THEN
    RAISE EXCEPTION 'Invalid verification tier: %', new_tier;
  END IF;
  UPDATE user_preferences SET
    verification_tier = new_tier,
    phone_verified_at = CASE WHEN new_tier >= 'tier_1' AND phone_verified_at IS NULL THEN now() ELSE phone_verified_at END,
    id_verified_at = CASE WHEN new_tier >= 'tier_2' AND id_verified_at IS NULL THEN now() ELSE id_verified_at END,
    verification_provider = COALESCE(provider, verification_provider),
    verification_reference_id = COALESCE(reference_id, verification_reference_id),
    updated_at = now()
  WHERE user_id = target_user_id;
  INSERT INTO verification_audit_log (user_id, event_type, metadata)
  VALUES (target_user_id, 'tier_upgrade', jsonb_build_object('new_tier', new_tier, 'provider', provider));
END; $$;

REVOKE EXECUTE ON FUNCTION upgrade_user_tier FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 2: Extend members, parties, electorates
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE members ADD COLUMN IF NOT EXISTS official_email_domain text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS verified_on_verity_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS verity_seal_active boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS contact_channels jsonb DEFAULT '{}';
ALTER TABLE members ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE parties ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS leader_politician_id uuid REFERENCES members(id);

ALTER TABLE electorates ADD COLUMN IF NOT EXISTS current_mp_id uuid REFERENCES members(id);

UPDATE electorates e SET current_mp_id = m.id
FROM members m WHERE m.electorate_id = e.id AND m.chamber = 'house' AND m.is_active = true AND e.current_mp_id IS NULL;

UPDATE members SET official_email_domain = 'aph.gov.au'
WHERE level = 'federal' AND official_email_domain IS NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 3: Verification infrastructure tables + tier-gated RLS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS verification_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL, event_type text NOT NULL,
  event_at timestamptz DEFAULT now(), metadata jsonb DEFAULT '{}', ip_hash text
);
ALTER TABLE verification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS phone_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_hash text NOT NULL, user_id uuid NOT NULL,
  verified_at timestamptz, attempt_count integer DEFAULT 0,
  last_attempt_at timestamptz, created_at timestamptz DEFAULT now(),
  UNIQUE(phone_hash)
);
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION get_user_tier(uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE((SELECT verification_tier FROM user_preferences WHERE user_id = uid), 'tier_0');
$$;

CREATE OR REPLACE FUNCTION user_meets_tier(uid uuid, min_tier text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT CASE min_tier
    WHEN 'tier_0' THEN true
    WHEN 'tier_1' THEN get_user_tier(uid) IN ('tier_1', 'tier_2', 'politician')
    WHEN 'tier_2' THEN get_user_tier(uid) IN ('tier_2', 'politician')
    WHEN 'politician' THEN get_user_tier(uid) = 'politician'
    ELSE false
  END;
$$;
