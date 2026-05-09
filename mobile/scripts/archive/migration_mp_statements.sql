-- ─────────────────────────────────────────────────────────────────────────────
-- MP statements pipeline — schema hardening for the representative_updates
-- ingestion.
--
-- Two changes, both idempotent:
--   1. Create ingestion_review_queue (rows the scraper couldn't verify).
--   2. Enforce source_url NOT NULL on representative_updates so the table
--      cannot hold an unsourced statement — a post without a verifiable link
--      to an official site is not publishable by design.
--
-- Safe to run multiple times. If representative_updates already has
-- unsourced rows, the NOT NULL step will fail loudly — clean up those
-- rows first, then re-run.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. ingestion_review_queue ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_review_queue (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table   text NOT NULL,
  proposed_data  jsonb NOT NULL,
  reason         text,
  resolved       boolean NOT NULL DEFAULT false,
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_review_queue_unresolved
  ON ingestion_review_queue(resolved, created_at DESC)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_ingestion_review_queue_source_table
  ON ingestion_review_queue(source_table);

ALTER TABLE ingestion_review_queue ENABLE ROW LEVEL SECURITY;

-- Only service_role should read/write this table; no client-side exposure.
-- (No policies created → RLS blocks all anon/authenticated access by default.)


-- ── 2. representative_updates.source_url NOT NULL ───────────────────────────
-- First: fail loudly if any row violates the constraint so the operator can
-- investigate instead of silently dropping data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM representative_updates WHERE source_url IS NULL LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'representative_updates has rows with NULL source_url. '
      'Clean up or backfill before enforcing the constraint. '
      'Query: SELECT id, content FROM representative_updates WHERE source_url IS NULL;';
  END IF;
END
$$;

-- Constraint + unique index combo. Uniqueness on (member_id, source_url)
-- prevents re-inserting the same statement for the same MP.
ALTER TABLE representative_updates
  ALTER COLUMN source_url SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_representative_updates_member_sourceurl
  ON representative_updates(member_id, source_url);

CREATE INDEX IF NOT EXISTS idx_representative_updates_member_published
  ON representative_updates(member_id, published_at DESC);


-- ── 3. representative_updates.source_domain ────────────────────────────────
-- Denormalised hostname of source_url. Kept for defamation review: if an
-- attribution dispute arises, a single query can surface every statement
-- sourced from a given domain (e.g. "show me all statements from
-- ministers.treasury.gov.au" — fast via the btree index below).
ALTER TABLE representative_updates ADD COLUMN IF NOT EXISTS source_domain text;

CREATE INDEX IF NOT EXISTS idx_representative_updates_source_domain
  ON representative_updates(source_domain);


-- ── Verification queries ────────────────────────────────────────────────────
--   -- Unsourced rows that would block the NOT NULL step:
--   SELECT COUNT(*) FROM representative_updates WHERE source_url IS NULL;
--
--   -- Unresolved items flagged for manual review:
--   SELECT id, source_table, reason, created_at
--   FROM ingestion_review_queue
--   WHERE resolved = false
--   ORDER BY created_at DESC LIMIT 20;
--
--   -- Statements ingested today:
--   SELECT m.first_name || ' ' || m.last_name AS mp, r.content, r.source_url, r.published_at
--   FROM representative_updates r
--   JOIN members m ON m.id = r.member_id
--   WHERE r.created_at > now() - interval '1 day'
--   ORDER BY r.published_at DESC;
