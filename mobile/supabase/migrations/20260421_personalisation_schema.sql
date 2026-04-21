-- Personalisation schema additions — applied 2026-04-21
-- issues master table, user_interactions behavioral graph, demographic columns,
-- relevance_cache, RLS policies, delete_user_data RPC

CREATE TABLE IF NOT EXISTS issues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  category text,
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  interaction_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relevance_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_hash text NOT NULL,
  content_type text NOT NULL,
  content_id text NOT NULL,
  relevance_line text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  UNIQUE(profile_hash, content_type, content_id)
);

-- user_preferences gains: age_bracket, income_bracket, household_type

CREATE OR REPLACE FUNCTION delete_user_data(target_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM user_interactions WHERE user_id = target_user_id;
  DELETE FROM user_follows WHERE user_id = target_user_id;
  DELETE FROM user_saves WHERE user_id = target_user_id;
  DELETE FROM relevance_cache WHERE profile_hash LIKE target_user_id::text || '%';
  DELETE FROM notification_preferences WHERE user_id = target_user_id;
  DELETE FROM push_tokens WHERE user_id = target_user_id;
  DELETE FROM user_preferences WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
