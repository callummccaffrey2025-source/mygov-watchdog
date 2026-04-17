-- ─────────────────────────────────────────────────────────────────────────────
-- Civic content filter — columns added to support the news ingestion filter.
--
-- Safe to run multiple times: every DDL uses IF NOT EXISTS or the idempotent
-- equivalent. If your environment already has these columns (e.g. because they
-- were added via the Supabase dashboard), this is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── news_articles.is_civic ──────────────────────────────────────────────────
-- Boolean flag set at ingestion time from compute_civic() in ingest_news.py.
-- The mobile app filters to is_civic = true everywhere it shows story coverage.
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS is_civic boolean NOT NULL DEFAULT true;

-- Index helps both the article-by-story filter (hot path on story detail) and
-- the COUNT(*) ... WHERE is_civic = false verification queries.
CREATE INDEX IF NOT EXISTS idx_news_articles_is_civic ON news_articles(is_civic);


-- ── news_articles.civic_score ───────────────────────────────────────────────
-- Integer — how many civic keywords matched. Stored for debugging / tuning the
-- filter later; the app itself only reads is_civic.
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS civic_score integer NOT NULL DEFAULT 0;


-- ── news_sources.ingest_enabled ─────────────────────────────────────────────
-- Per-source kill switch. TRUE (or NULL → treated as TRUE) keeps ingestion
-- running. FALSE drops the source from every fetch path.
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS ingest_enabled boolean NOT NULL DEFAULT true;

-- Index supports the "select * from news_sources where ingest_enabled != false"
-- scan at the top of the RSS loop.
CREATE INDEX IF NOT EXISTS idx_news_sources_ingest_enabled ON news_sources(ingest_enabled);


-- ── news_stories.civic_article_count ────────────────────────────────────────
-- Denormalised count of linked civic articles. Recomputed at the end of each
-- ingest run by recompute_civic_article_counts() in ingest_news.py.
ALTER TABLE news_stories ADD COLUMN IF NOT EXISTS civic_article_count integer NOT NULL DEFAULT 0;


-- ── v_civic_news_stories (rebuild, not destructive) ─────────────────────────
-- The view feeding the mobile app. Defined here so the two filters (article
-- count ≥ 3 AND civic_article_count ≥ 1 AND is_civic-aware articles) stay in
-- sync with the app expectations. If you already have this view with a
-- different definition, inspect and reconcile before running.
--
-- This definition is intentionally simple: any story that clusters at least
-- one civic article and has at least 3 total articles is a civic story.
CREATE OR REPLACE VIEW v_civic_news_stories AS
SELECT *
FROM news_stories
WHERE civic_article_count >= 1
  AND article_count >= 3;


-- ── Verification queries ────────────────────────────────────────────────────
-- Run these after the next ingestion run to confirm the filter is working:
--
--   -- Should return 0 after any run where all recent articles went through the new filter:
--   SELECT COUNT(*) FROM news_articles
--   WHERE is_civic = false
--     AND created_at > now() - interval '1 hour';
--
--   -- Spot-check which stories survived:
--   SELECT COUNT(*) FROM v_civic_news_stories;
--
--   -- Inspect any source that's been silenced:
--   SELECT name, owner, ingest_enabled FROM news_sources WHERE ingest_enabled = false;
