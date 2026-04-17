-- ─────────────────────────────────────────────────────────────────────────────
-- local_announcements pipeline — schema hardening.
--
-- Two additive columns + NOT NULL constraint on source_url. Mirrors the
-- pattern established for representative_updates: no row may exist without a
-- verifiable link back to an official .gov.au page (or, in the case of
-- ministerial media releases, an MP's published statement URL).
--
-- Safe to run multiple times. If local_announcements has existing rows
-- without source_url, the DO block will raise — clean them up first.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Columns ─────────────────────────────────────────────────────────────────
ALTER TABLE local_announcements ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE local_announcements ADD COLUMN IF NOT EXISTS source      text;


-- Guard: abort if existing rows violate NOT NULL so we don't silently drop data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM local_announcements WHERE source_url IS NULL LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'local_announcements has rows with NULL source_url. '
      'Clean up before enforcing the constraint. '
      'Query: SELECT id, title FROM local_announcements WHERE source_url IS NULL;';
  END IF;
END
$$;

ALTER TABLE local_announcements
  ALTER COLUMN source_url SET NOT NULL;


-- ── Indexes ─────────────────────────────────────────────────────────────────
-- Dedup: the same source URL should only ever produce one announcement.
CREATE UNIQUE INDEX IF NOT EXISTS idx_local_announcements_source_url
  ON local_announcements(source_url);

-- Per-electorate feed (HomeScreen + LocalAnnouncementsScreen read path).
CREATE INDEX IF NOT EXISTS idx_local_announcements_electorate_announced
  ON local_announcements(electorate_id, announced_at DESC);

-- State fallback (HomeScreen fallback when the electorate has no rows).
CREATE INDEX IF NOT EXISTS idx_local_announcements_state_announced
  ON local_announcements(state, announced_at DESC);


-- ── Verification queries ────────────────────────────────────────────────────
--   -- Unsourced rows that would block the NOT NULL step:
--   SELECT COUNT(*) FROM local_announcements WHERE source_url IS NULL;
--
--   -- By source:
--   SELECT source, COUNT(*) FROM local_announcements GROUP BY source;
--
--   -- Announcements for an electorate:
--   SELECT title, budget_amount, announced_at, source_url
--   FROM local_announcements
--   WHERE electorate_id = 'the-uuid'
--   ORDER BY announced_at DESC;
