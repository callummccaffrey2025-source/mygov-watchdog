-- Verity Database — Baseline Schema
-- ==================================
-- Consolidated from production as of 2026-05-06 (Prompt 4).
-- Replaces 30+ individual migration scripts (archived in scripts/archive/).
--
-- This file is the single source of truth for what the schema SHOULD look like.
-- All statements use CREATE TABLE IF NOT EXISTS — safe to re-run.
--
-- To verify production matches this baseline:
--   python scripts/verify_schema.py
--
-- Tables: 88 in public schema (+ spatial_ref_sys from PostGIS)
-- Archived: 4 tables in archived schema (politicians, donor_influence, bill_electorate_sentiment, political_risk)

-- ============================================================================
-- ARCHIVED SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS archived;

-- ============================================================================
-- CORE DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  party_id uuid,
  electorate_id uuid,
  chamber text NOT NULL,
  level text NOT NULL DEFAULT 'federal',
  role text,
  photo_url text,
  email text,
  phone text,
  social_twitter text,
  social_facebook text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  aph_id text,
  ministerial_role text,
  role_rank integer DEFAULT 999,
  country text DEFAULT 'AU',
  official_email_domain text,
  verified_on_verity_at timestamptz,
  verity_seal_active boolean DEFAULT false,
  contact_channels jsonb DEFAULT '{}',
  bio text
);

CREATE TABLE IF NOT EXISTS parties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  abbreviation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  short_name text,
  colour text,
  logo_url text,
  level text NOT NULL DEFAULT 'federal',
  website_url text,
  leader_politician_id uuid,
  description text,
  leader text,
  deputy_leader text,
  founded_year integer,
  ideology text,
  federal_seats integer,
  last_verified_at timestamptz
);

CREATE TABLE IF NOT EXISTS electorates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL,
  margin_percent numeric,
  is_marginal boolean DEFAULT false,
  holding_party text,
  last_updated timestamptz DEFAULT now(),
  population integer,
  area_sqkm numeric,
  profile_url text,
  level text NOT NULL DEFAULT 'federal',
  postcodes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  current_mp_id uuid
);

CREATE TABLE IF NOT EXISTS divisions (
  id text NOT NULL PRIMARY KEY,
  tvfy_id integer,
  name text NOT NULL,
  date date NOT NULL,
  chamber text NOT NULL,
  bill_title text,
  bill_id uuid,
  aye_votes integer DEFAULT 0,
  no_votes integer DEFAULT 0,
  possible_turnout integer DEFAULT 0,
  rebellions integer DEFAULT 0,
  clock_time text,
  source_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS division_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  division_id text,
  politician_id text,
  tvfy_person_id integer,
  vote_cast text NOT NULL,
  rebelled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  member_id uuid
);

CREATE TABLE IF NOT EXISTS bills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  summary_short text,
  summary_full text,
  analysis_pro text,
  analysis_con text,
  current_status text,
  date_introduced date,
  origin_chamber text,
  official_url text,
  last_updated timestamptz DEFAULT now(),
  official_link text,
  last_summarized_at timestamptz,
  insight_flag text,
  last_analyzed_at timestamptz,
  aph_id text,
  parliament_no integer,
  bill_type text,
  sponsor text,
  portfolio text,
  act_no text,
  passed_house date,
  passed_senate date,
  assent_date date,
  intro_house date,
  intro_senate date,
  summary_source text DEFAULT 'ai',
  aph_url text,
  text_url text,
  em_url text,
  tldr text,
  summary text,
  supporters_argument text,
  critics_argument text,
  source_url text,
  date date,
  country_code text,
  pass_probability double precision,
  short_title text,
  summary_raw text,
  summary_plain text,
  status text,
  chamber_introduced text,
  level text NOT NULL DEFAULT 'federal',
  state text,
  categories text[] NOT NULL DEFAULT '{}',
  country text DEFAULT 'AU',
  expanded_summary text,
  summary_generated_at timestamptz,
  sponsor_id uuid,
  sponsor_party text,
  narrative_status text DEFAULT 'unknown',
  is_live boolean DEFAULT false,
  days_since_movement integer,
  politics_cache jsonb,
  politics_generated_at timestamptz,
  relevance_issues text[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS bill_arguments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id uuid NOT NULL,
  side text NOT NULL,
  argument_text text NOT NULL,
  source text
);

CREATE TABLE IF NOT EXISTS bill_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id text NOT NULL,
  change_type text NOT NULL,
  previous_value text,
  new_value text,
  change_description text,
  detected_at timestamptz DEFAULT now(),
  source_url text
);

CREATE TABLE IF NOT EXISTS bill_personal_impact (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id uuid NOT NULL,
  user_id uuid NOT NULL,
  profile_hash text NOT NULL,
  affects_you text NOT NULL DEFAULT 'unknown',
  affects_you_reason text,
  how_it_affects_you text,
  who_benefits text,
  who_pays text,
  quantified_impact jsonb,
  generated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bill_ingestion_log (
  id bigint NOT NULL PRIMARY KEY,
  bill_id text NOT NULL,
  action text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS committee_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL,
  committee_name text NOT NULL,
  committee_type text,
  role text NOT NULL DEFAULT 'member',
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hansard_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid,
  date date NOT NULL,
  debate_topic text,
  excerpt text,
  source_url text,
  chamber text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  politician_id integer,
  donor_name text NOT NULL,
  amount numeric NOT NULL,
  donation_date date,
  industry text,
  donor_type text,
  financial_year text,
  party_id uuid,
  aec_return_id text,
  disclosure_type text,
  receipt_type text,
  donor_abn text,
  donor_address text,
  state text
);

CREATE TABLE IF NOT EXISTS individual_donations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid,
  donor_name text NOT NULL,
  donor_type text,
  amount numeric NOT NULL,
  financial_year text NOT NULL,
  receipt_type text,
  recipient_name text,
  aec_return_id integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registered_interests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid,
  category text NOT NULL,
  description text NOT NULL,
  date_registered date,
  source_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS government_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cn_id text NOT NULL,
  agency text NOT NULL,
  description text,
  value numeric,
  supplier_name text,
  supplier_abn text,
  supplier_postcode text,
  supplier_state text,
  procurement_method text,
  category text,
  start_date date,
  end_date date,
  publish_date date,
  electorate_id uuid,
  source_url text DEFAULT 'https://www.tenders.gov.au',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS electorate_demographics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  electorate_id uuid,
  census_year integer NOT NULL DEFAULT 2021,
  population integer,
  median_age numeric,
  median_household_income_weekly numeric,
  median_personal_income_weekly numeric,
  median_family_income_weekly numeric,
  median_rent_weekly numeric,
  median_mortgage_monthly numeric,
  avg_household_size numeric,
  pct_owned_outright numeric,
  pct_owned_mortgage numeric,
  pct_renting numeric,
  top_industries jsonb,
  education_levels jsonb,
  age_brackets jsonb,
  languages_other_than_english jsonb,
  source_url text DEFAULT 'https://www.abs.gov.au/census',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participation_index (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL,
  methodology_version text NOT NULL DEFAULT '1.0',
  period_start date NOT NULL,
  period_end date NOT NULL,
  speeches_total integer DEFAULT 0,
  speeches_substantive integer DEFAULT 0,
  questions_asked integer DEFAULT 0,
  parliamentary_activity_value numeric,
  parliamentary_activity_percentile numeric,
  parliamentary_activity_ci_low numeric,
  parliamentary_activity_ci_high numeric,
  divisions_eligible integer DEFAULT 0,
  votes_cast integer DEFAULT 0,
  voting_participation_value numeric,
  voting_participation_percentile numeric,
  voting_participation_ci_low numeric,
  voting_participation_ci_high numeric,
  votes_with_party integer DEFAULT 0,
  votes_against_party integer DEFAULT 0,
  independence_value numeric,
  independence_percentile numeric,
  independence_ci_low numeric,
  independence_ci_high numeric,
  active_committees integer DEFAULT 0,
  inquiry_participations integer DEFAULT 0,
  committee_value numeric,
  committee_percentile numeric,
  committee_ci_low numeric,
  committee_ci_high numeric,
  context_flags text[] DEFAULT '{}',
  excluded_from_comparison boolean DEFAULT false,
  exclusion_reason text,
  sample_size integer DEFAULT 0,
  calculated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mp_contradictions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL,
  story_id integer,
  claim_text text NOT NULL,
  claim_source text,
  claim_date date NOT NULL,
  contra_type text NOT NULL,
  contra_source_id text NOT NULL,
  contra_text text NOT NULL,
  contra_date date NOT NULL,
  confidence real NOT NULL DEFAULT 0.0,
  ai_explanation text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS promises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id uuid,
  member_id uuid,
  promise_text text NOT NULL,
  source_quote text NOT NULL,
  source_url text NOT NULL,
  source_date date NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'not_started',
  status_evidence text,
  status_last_reviewed date,
  related_bill_ids text[] DEFAULT '{}',
  reviewed_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- NEWS & INTELLIGENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS news_sources (
  id integer NOT NULL PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  name text NOT NULL,
  slug text NOT NULL,
  rss_url text,
  leaning text NOT NULL,
  logo_url text,
  website_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  bias_score numeric,
  factuality_rating text,
  factuality_numeric integer,
  media_type text,
  owner text,
  paywall boolean DEFAULT false,
  ingest_enabled boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS news_articles (
  id integer NOT NULL PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  source_id integer NOT NULL,
  title text NOT NULL,
  description text,
  url text NOT NULL,
  published_at timestamptz NOT NULL,
  image_url text,
  category text,
  created_at timestamptz DEFAULT now(),
  is_civic boolean,
  civic_score numeric
);

CREATE TABLE IF NOT EXISTS news_stories (
  id integer NOT NULL PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  headline text NOT NULL,
  slug text NOT NULL,
  category text,
  first_seen timestamptz DEFAULT now(),
  article_count integer DEFAULT 1,
  left_count integer DEFAULT 0,
  center_count integer DEFAULT 0,
  right_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  image_url text,
  ai_summary text,
  blindspot text,
  avg_factuality numeric,
  owner_count integer DEFAULT 0,
  country text DEFAULT 'AU',
  civic_article_count integer DEFAULT 0,
  relevance_issues text[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS news_story_articles (
  id integer NOT NULL PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  story_id integer NOT NULL,
  article_id integer NOT NULL
);

CREATE TABLE IF NOT EXISTS news_items (
  id bigint NOT NULL PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  headline text NOT NULL,
  summary text NOT NULL,
  source text NOT NULL DEFAULT 'Parliamentary Record',
  url text,
  category text NOT NULL,
  published_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_releases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  link text NOT NULL,
  ai_summary text,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid,
  title text,
  content text NOT NULL,
  url text,
  sha256_hash text,
  published_at timestamptz,
  ingested_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_ownership_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name text NOT NULL,
  parent_company text,
  country text DEFAULT 'AU',
  notes text
);

CREATE TABLE IF NOT EXISTS verified_source_domains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL,
  domain_type text NOT NULL,
  member_id uuid,
  party_id uuid,
  is_active boolean DEFAULT true,
  verified_at date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_primary_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id integer NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  member_id uuid,
  relevance real NOT NULL DEFAULT 0.0,
  excerpt text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_coverage_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id integer,
  total_sources integer DEFAULT 0,
  left_sources integer DEFAULT 0,
  center_sources integer DEFAULT 0,
  right_sources integer DEFAULT 0,
  left_outlet_names text[] DEFAULT '{}',
  center_outlet_names text[] DEFAULT '{}',
  right_outlet_names text[] DEFAULT '{}',
  blindspot_type text,
  blindspot_severity text,
  is_blindspot boolean DEFAULT false,
  analyzed_at timestamptz DEFAULT now(),
  country text DEFAULT 'AU'
);

CREATE TABLE IF NOT EXISTS story_factchecks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id integer,
  article_id integer,
  user_id uuid NOT NULL,
  claim_text text NOT NULL,
  claim_source text,
  context_text text NOT NULL,
  context_type text NOT NULL,
  source_urls text[] DEFAULT '{}',
  helpful_count integer DEFAULT 0,
  unhelpful_count integer DEFAULT 0,
  status text DEFAULT 'pending',
  moderator_notes text,
  reviewed_at timestamptz,
  country text DEFAULT 'AU',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_money_trails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id integer,
  member_id uuid,
  member_name text,
  member_party text,
  donor_name text NOT NULL,
  donor_industry text,
  donation_amount numeric DEFAULT 0,
  donation_financial_year text,
  related_topic text,
  relevance_score real DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  country text DEFAULT 'AU'
);

CREATE TABLE IF NOT EXISTS story_mp_context (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id integer,
  member_id uuid,
  member_name text,
  member_party text,
  member_electorate text,
  voted_on_related_bill boolean DEFAULT false,
  vote_position text,
  related_bill_id uuid,
  related_bill_title text,
  spoke_in_parliament boolean DEFAULT false,
  speech_count integer DEFAULT 0,
  latest_speech_date timestamptz,
  latest_speech_topic text,
  received_related_donations boolean DEFAULT false,
  related_donation_total numeric DEFAULT 0,
  related_donor_names text[] DEFAULT '{}',
  posted_on_verity boolean DEFAULT false,
  latest_post_excerpt text,
  involvement_level text DEFAULT 'none',
  summary_text text,
  computed_at timestamptz DEFAULT now(),
  country text DEFAULT 'AU'
);

CREATE TABLE IF NOT EXISTS story_timelines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id integer,
  topic_slug text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_verdicts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id integer,
  verdict_summary text NOT NULL,
  detailed_summary text,
  sources_analyzed integer DEFAULT 0,
  left_sources_used integer DEFAULT 0,
  center_sources_used integer DEFAULT 0,
  right_sources_used integer DEFAULT 0,
  model_used text DEFAULT 'claude-sonnet',
  generated_at timestamptz DEFAULT now(),
  country text DEFAULT 'AU'
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_slug text NOT NULL,
  event_date timestamptz NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  source_url text,
  story_id integer,
  bill_id uuid,
  member_id uuid,
  hansard_id uuid,
  importance text DEFAULT 'normal',
  is_turning_point boolean DEFAULT false,
  country text DEFAULT 'AU',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timeline_topics (
  slug text NOT NULL PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text,
  is_active boolean DEFAULT true,
  country text DEFAULT 'AU',
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- POLLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS published_polls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pollster text NOT NULL,
  poll_type text NOT NULL DEFAULT 'federal_voting_intention',
  scope text NOT NULL DEFAULT 'federal',
  field_start_date date NOT NULL,
  field_end_date date NOT NULL,
  publish_date date NOT NULL,
  sample_size integer,
  methodology text,
  primary_alp numeric,
  primary_lnp numeric,
  primary_grn numeric,
  primary_one_nation numeric,
  primary_other numeric,
  tpp_alp numeric,
  tpp_lnp numeric,
  pm_approve numeric,
  pm_disapprove numeric,
  opp_approve numeric,
  opp_disapprove numeric,
  preferred_pm_alp numeric,
  preferred_pm_lnp numeric,
  source_url text NOT NULL,
  wikipedia_revision_url text,
  ingested_at timestamptz DEFAULT now(),
  verified_by_human boolean DEFAULT false,
  notes text
);

CREATE TABLE IF NOT EXISTS poll_aggregates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL DEFAULT 'federal',
  as_of_date date NOT NULL,
  window_days integer NOT NULL,
  tpp_alp numeric,
  tpp_lnp numeric,
  primary_alp numeric,
  primary_lnp numeric,
  primary_grn numeric,
  methodology text DEFAULT 'simple_average',
  poll_count integer
);

CREATE TABLE IF NOT EXISTS daily_polls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  publish_date date NOT NULL,
  question text NOT NULL,
  option_a_text text NOT NULL,
  option_b_text text NOT NULL,
  skip_text text DEFAULT 'Not sure',
  source_article_url text NOT NULL,
  source_article_title text,
  source_article_outlet text,
  source_article_published_at timestamptz,
  ai_generation_metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  withdrawn_reason text,
  withdrawn_at timestamptz,
  withdrawn_by uuid,
  published_at timestamptz,
  resolves_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_poll_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL,
  user_id uuid NOT NULL,
  option_chosen text NOT NULL,
  vote_weight real DEFAULT 1.0,
  trust_factors jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_admin_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid,
  action_type text NOT NULL,
  reason text,
  performed_by uuid,
  performed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  free_text text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- USER DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid NOT NULL PRIMARY KEY,
  postcode text,
  electorate_id uuid,
  followed_members text[] NOT NULL DEFAULT '{}',
  followed_parties text[] NOT NULL DEFAULT '{}',
  followed_topics text[] NOT NULL DEFAULT '{}',
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_pro boolean NOT NULL DEFAULT false,
  pro_expires_at timestamptz,
  device_id text,
  member_id uuid,
  electorate text,
  selected_topics text[] DEFAULT '{}',
  onboarding_completed_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  age_bracket text,
  income_bracket text,
  household_type text,
  state text,
  council text,
  tracked_issues text[] DEFAULT '{}',
  housing_status text,
  household text,
  read_topics jsonb DEFAULT '{}',
  followed_member_ids text[] DEFAULT '{}',
  political_alignment jsonb DEFAULT '{}',
  onboarding_version integer DEFAULT 1,
  verification_tier text DEFAULT 'tier_0',
  phone_verified_at timestamptz,
  id_verified_at timestamptz,
  verification_provider text,
  verification_reference_id text,
  phone_hash text
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid NOT NULL PRIMARY KEY,
  postcode text,
  housing_status text,
  industry text,
  created_at timestamptz NOT NULL DEFAULT now(),
  civic_streak integer DEFAULT 0,
  last_brief_read_date date
);

CREATE TABLE IF NOT EXISTS user_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  device_id text
);

CREATE TABLE IF NOT EXISTS user_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  content_type text NOT NULL,
  content_id text NOT NULL,
  read_at timestamptz DEFAULT now(),
  time_spent_ms integer
);

CREATE TABLE IF NOT EXISTS user_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  interaction_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_engagement_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  stat_date date NOT NULL,
  bills_read integer DEFAULT 0,
  mp_profiles_viewed integer DEFAULT 0,
  news_stories_read integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  bill_id uuid,
  politician_id uuid,
  category text,
  severity text,
  message_headline text NOT NULL,
  message_body text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigint NOT NULL PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  user_id uuid,
  session_id text,
  event_name text NOT NULL,
  screen_name text,
  event_data jsonb,
  device_platform text,
  app_version text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  postcode text,
  electorate text,
  member_id uuid,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid NOT NULL PRIMARY KEY,
  new_bills boolean NOT NULL DEFAULT true,
  mp_votes boolean NOT NULL DEFAULT true,
  election_updates boolean NOT NULL DEFAULT true,
  local_announcements boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  daily_brief boolean DEFAULT true,
  breaking_news boolean DEFAULT true,
  weekly_summary boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  member_id uuid,
  recipients integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS share_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  electorate_id uuid,
  content_type text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  member_id uuid,
  subject text,
  message_preview text,
  sentiment text,
  sent_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- COMMUNITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  electorate text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  post_type text DEFAULT 'discussion',
  topic text,
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  is_removed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid,
  user_id uuid,
  device_id text,
  body text NOT NULL,
  upvotes integer DEFAULT 0,
  is_removed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  vote_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  ip_hash text,
  action text,
  phone_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS phone_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_hash text NOT NULL,
  user_id uuid NOT NULL,
  verified_at timestamptz,
  attempt_count integer DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz DEFAULT now(),
  verification_sid text,
  status text DEFAULT 'pending',
  ip_hash text,
  expires_at timestamptz DEFAULT (now() + interval '5 minutes')
);

-- ============================================================================
-- CONTENT & FEATURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_briefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  stories jsonb NOT NULL DEFAULT '[]',
  bills_to_watch text[] DEFAULT '{}',
  national_updates jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  electorate text NOT NULL DEFAULT '__national__',
  ai_text jsonb,
  is_personalised boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS party_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id uuid NOT NULL,
  category text NOT NULL,
  summary_plain text NOT NULL,
  source_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sitting_calendar (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  chamber text NOT NULL DEFAULT 'both',
  is_sitting boolean NOT NULL DEFAULT true,
  description text
);

CREATE TABLE IF NOT EXISTS representative_updates (
  id integer NOT NULL PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  member_id uuid NOT NULL,
  content text NOT NULL,
  source text NOT NULL,
  source_url text NOT NULL,
  published_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  source_domain text,
  verification_status text DEFAULT 'unverified',
  scraped_at timestamptz DEFAULT now(),
  content_hash text
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  details jsonb,
  error text
);

CREATE TABLE IF NOT EXISTS pipeline_heartbeats (
  pipeline_name text NOT NULL PRIMARY KEY,
  last_success timestamptz NOT NULL,
  bills_processed integer DEFAULT 0,
  bills_inserted integer DEFAULT 0,
  bills_updated integer DEFAULT 0,
  duration_seconds numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS morning_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  electorate text NOT NULL DEFAULT '__national__',
  top_stories jsonb NOT NULL,
  shifted_positions jsonb,
  bill_movements jsonb,
  blindspot jsonb,
  electorate_impact text,
  generation_model text DEFAULT 'claude-haiku-4-5-20251001',
  generation_cost real,
  token_count integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civic_quiz (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer integer NOT NULL,
  explanation text NOT NULL,
  source_url text,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civic_quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer integer NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS local_announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text,
  category text,
  electorate_id uuid,
  state text,
  member_id uuid,
  budget_amount text,
  announced_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_url text NOT NULL
);

CREATE TABLE IF NOT EXISTS local_developments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  da_number text NOT NULL,
  description text,
  estimated_cost numeric,
  address text,
  postcode text NOT NULL,
  status text,
  suburb text,
  date_lodged date,
  property_threat_level text,
  plain_english_summary text,
  planning_portal_number text,
  data_source text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fun_facts (
  id bigint NOT NULL PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  fact text NOT NULL,
  category text NOT NULL,
  source text NOT NULL DEFAULT 'Parliamentary Education Office',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- REFERENCE & MAPPING
-- ============================================================================

CREATE TABLE IF NOT EXISTS issue_catalog (
  id text NOT NULL PRIMARY KEY,
  label text NOT NULL,
  description text,
  topic text NOT NULL,
  icon_name text DEFAULT 'bookmark-outline',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  category text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS state_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  first_name text,
  last_name text,
  party text,
  electorate text,
  chamber text,
  state text NOT NULL,
  photo_url text,
  role text,
  email text,
  phone text,
  website text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS state_bills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  status text,
  introduced_date text,
  chamber text,
  state text NOT NULL,
  summary text,
  source_url text,
  external_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS councils (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL,
  type text NOT NULL,
  website text,
  mayor_name text,
  area_postcodes text[],
  created_at timestamptz DEFAULT now(),
  phone text,
  email text,
  address text,
  population integer,
  area_sqkm numeric
);

CREATE TABLE IF NOT EXISTS councillors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  council_id uuid NOT NULL,
  name text NOT NULL,
  ward text,
  role text
);

CREATE TABLE IF NOT EXISTS election_cycles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_type text NOT NULL,
  state text,
  election_date date NOT NULL,
  parliament_no integer,
  first_sitting_date date,
  is_upcoming boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS election_info (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_type text NOT NULL DEFAULT 'federal',
  state text,
  election_date date,
  is_called boolean NOT NULL DEFAULT false,
  candidates jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS electorate_mapping (
  id bigint NOT NULL PRIMARY KEY,
  postcode text NOT NULL,
  suburb text NOT NULL,
  electorate_name text NOT NULL
);

CREATE TABLE IF NOT EXISTS email_domain_blocklist (
  domain text NOT NULL PRIMARY KEY,
  reason text DEFAULT 'disposable',
  added_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_limitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL,
  limitation_summary text NOT NULL,
  full_explanation text NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS industry_topic_mapping (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  industry text NOT NULL,
  related_topics text[] NOT NULL,
  keywords text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relevance_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_hash text NOT NULL,
  content_type text NOT NULL,
  content_id text NOT NULL,
  relevance_line text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);
