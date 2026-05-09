-- Published Australian Polling — applied 2026-05-04
-- Tables: published_polls, poll_aggregates
-- Function: calculate_poll_aggregate
-- Cron: recompute-poll-aggregates (jobid 12, nightly 3am AEST)
-- DO NOT re-run — already applied to production.

CREATE TABLE IF NOT EXISTS published_polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pollster text NOT NULL,
  poll_type text NOT NULL DEFAULT 'federal_voting_intention',
  scope text NOT NULL DEFAULT 'federal',
  field_start_date date NOT NULL,
  field_end_date date NOT NULL,
  publish_date date NOT NULL,
  sample_size int,
  methodology text,
  primary_alp numeric(4,1),
  primary_lnp numeric(4,1),
  primary_grn numeric(4,1),
  primary_one_nation numeric(4,1),
  primary_other numeric(4,1),
  tpp_alp numeric(4,1),
  tpp_lnp numeric(4,1),
  pm_approve numeric(4,1),
  pm_disapprove numeric(4,1),
  opp_approve numeric(4,1),
  opp_disapprove numeric(4,1),
  preferred_pm_alp numeric(4,1),
  preferred_pm_lnp numeric(4,1),
  source_url text NOT NULL,
  wikipedia_revision_url text,
  ingested_at timestamptz DEFAULT now(),
  verified_by_human boolean DEFAULT false,
  notes text,
  UNIQUE(pollster, field_end_date, poll_type, scope)
);

CREATE TABLE IF NOT EXISTS poll_aggregates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL DEFAULT 'federal',
  as_of_date date NOT NULL,
  window_days int NOT NULL,
  tpp_alp numeric(4,1),
  tpp_lnp numeric(4,1),
  primary_alp numeric(4,1),
  primary_lnp numeric(4,1),
  primary_grn numeric(4,1),
  methodology text DEFAULT 'simple_average',
  poll_count int,
  UNIQUE(scope, as_of_date, window_days)
);
