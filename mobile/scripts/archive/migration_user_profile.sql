-- Verity User Profile — Personalisation Infrastructure
-- Extends user_preferences with the four personalisation dimensions:
--   1. Geographic (postcode, electorate, state, council)
--   2. Interest (specific issues, not broad topics)
--   3. Demographic (housing, income bracket, age bracket, household)
--   4. Behavioural (computed from usage — read topics, followed MPs, saved items)
--
-- Run: supabase db execute --project-ref zmmglikiryuftqmoprqm < scripts/migration_user_profile.sql

-- ── Extend user_preferences with personalisation dimensions ──────────────────

-- Geographic (most already exist)
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS council text;

-- Interest: specific issues, not broad categories
-- e.g. ["housing_affordability", "medicare_bulk_billing", "renewable_energy_targets"]
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS tracked_issues text[] DEFAULT '{}';

-- Demographic
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS housing_status text; -- 'renter', 'owner', 'other'
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS age_bracket text;    -- '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS income_bracket text; -- 'under_50k', '50k_100k', '100k_150k', '150k_plus'
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS household text;     -- 'single', 'couple', 'family', 'shared'

-- Behavioural (auto-computed, not user-entered)
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS read_topics jsonb DEFAULT '{}';    -- { "housing": 12, "climate": 8 }
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS followed_member_ids text[] DEFAULT '{}';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS political_alignment jsonb DEFAULT '{}'; -- computed Political Twin data
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS onboarding_version integer DEFAULT 1;

-- ── Specific issues catalog ──────────────────────────────────────────────────
-- These are the concrete issues users can track, grouped by broad topic.
-- More specific than "economy" — users pick "cost of living" or "housing affordability"

CREATE TABLE IF NOT EXISTS issue_catalog (
  id text PRIMARY KEY,
  label text NOT NULL,
  description text,
  topic text NOT NULL,
  icon_name text DEFAULT 'bookmark-outline',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Seed the issue catalog
INSERT INTO issue_catalog (id, label, description, topic, icon_name, display_order) VALUES
  -- Economy
  ('cost_of_living',        'Cost of Living',            'Grocery, energy, and everyday costs',     'economy',      'cart-outline',          1),
  ('interest_rates',        'Interest Rates',            'RBA cash rate and mortgage costs',         'economy',      'trending-up-outline',   2),
  ('wages_growth',          'Wages & Employment',        'Pay rises, job market, and conditions',    'economy',      'cash-outline',          3),
  ('small_business_tax',    'Small Business & Tax',      'Tax policy for individuals and SMEs',      'economy',      'business-outline',      4),

  -- Housing
  ('housing_affordability', 'Housing Affordability',     'Home prices, deposits, and ownership',     'housing',      'home-outline',          5),
  ('rental_crisis',         'Rental Crisis',             'Rent prices, tenants rights, supply',      'housing',      'key-outline',           6),
  ('negative_gearing',      'Negative Gearing & CGT',   'Property investment tax concessions',      'housing',      'calculator-outline',    7),

  -- Health
  ('medicare_bulk_billing', 'Medicare & Bulk Billing',   'GP access and Medicare funding',           'health',       'medkit-outline',        8),
  ('mental_health',         'Mental Health',             'Mental health services and funding',        'health',       'heart-outline',         9),
  ('aged_care',             'Aged Care',                 'Aged care quality, funding, workforce',     'health',       'people-outline',        10),
  ('ndis',                  'NDIS',                      'Disability support scheme funding',         'health',       'accessibility-outline', 11),

  -- Climate
  ('renewable_energy',      'Renewable Energy',          'Solar, wind, and energy transition',        'climate',      'sunny-outline',         12),
  ('emissions_targets',     'Emissions Targets',         'Climate commitments and net zero',          'climate',      'leaf-outline',          13),
  ('nuclear_debate',        'Nuclear Energy Debate',     'Nuclear power proposals for Australia',     'climate',      'flash-outline',         14),

  -- Education
  ('university_funding',    'University & HECS',         'Higher education costs and student debt',   'education',    'school-outline',        15),
  ('school_funding',        'School Funding',            'Public vs private, Gonski, NAPLAN',         'education',    'book-outline',          16),

  -- Defence
  ('aukus',                 'AUKUS & Submarines',        'Nuclear submarine deal and defence spending', 'defence',    'shield-outline',        17),
  ('veterans',              'Veterans Affairs',          'Support for returned service personnel',      'defence',    'flag-outline',          18),

  -- Immigration
  ('migration_levels',      'Migration Levels',          'Immigration intake and visa policy',         'immigration', 'airplane-outline',      19),
  ('refugee_policy',        'Refugee Policy',            'Asylum seekers and humanitarian intake',     'immigration', 'globe-outline',         20),

  -- Social
  ('indigenous_voice',      'Indigenous Affairs',        'First Nations policy and Closing the Gap',   'indigenous_affairs', 'hand-left-outline', 21),
  ('childcare',             'Childcare',                 'Childcare costs, subsidies, and access',     'economy',     'happy-outline',         22),
  ('gender_equality',       'Gender Equality',           'Pay gap, safety, and workplace policy',      'justice',     'people-outline',        23)
ON CONFLICT (id) DO NOTHING;

-- ── Content relevance scoring support ────────────────────────────────────────
-- Pre-computed relevance tags on bills and news stories

ALTER TABLE bills ADD COLUMN IF NOT EXISTS relevance_issues text[] DEFAULT '{}';
ALTER TABLE news_stories ADD COLUMN IF NOT EXISTS relevance_issues text[] DEFAULT '{}';

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_bills_relevance ON bills USING GIN (relevance_issues) WHERE relevance_issues != '{}';
CREATE INDEX IF NOT EXISTS idx_stories_relevance ON news_stories USING GIN (relevance_issues) WHERE relevance_issues != '{}';

-- ── Behavioural tracking: content reads ──────────────────────────────────────
-- Tracks what users have read for the behavioural dimension

CREATE TABLE IF NOT EXISTS user_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  content_type text NOT NULL, -- 'bill', 'story', 'member', 'vote'
  content_id text NOT NULL,
  read_at timestamptz DEFAULT now(),
  time_spent_ms integer,
  CONSTRAINT user_reads_identity CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_reads_user ON user_reads(user_id, read_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reads_device ON user_reads(device_id, read_at DESC) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_reads_content ON user_reads(content_type, content_id);

-- RLS
ALTER TABLE user_reads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own reads" ON user_reads FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own reads" ON user_reads FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access reads" ON user_reads FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
