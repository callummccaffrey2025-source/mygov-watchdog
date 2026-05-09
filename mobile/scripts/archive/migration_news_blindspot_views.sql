-- ─────────────────────────────────────────────────────────────────────────────
-- Blindspot views: parliamentary events with no news coverage, and MPs who are
-- highly active but unmentioned in the news cycle.
--
-- Why materialised views:
--   The client-side `useBlindspots` hook already computes this correctly by
--   scanning recent headlines. That works fine at today's data scale, but the
--   scan is O(events × headlines) per client. Once we have ~6 months of news
--   history, it's cheaper to compute this once on the server and serve cached
--   rows.
--
-- Why NOT materialised views yet:
--   Materialised views need a refresh schedule (pg_cron) and don't stay fresh
--   between runs. We're shipping these as REGULAR views first so every query
--   returns the live state. Revisit this when the query plan shows seq-scan
--   pain or when news history exceeds ~50k rows.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. parliamentary_events_without_coverage ────────────────────────────────
-- Union of recent divisions + Hansard topics + bills where none of the
-- meaningful title words appear in any news_stories headline from the same
-- period. "Meaningful word" = length >= 5, lowercased. This is deliberately
-- generous; the client can tighten thresholds per-view.

DROP VIEW IF EXISTS parliamentary_events_without_coverage CASCADE;

CREATE VIEW parliamentary_events_without_coverage AS
WITH recent_headlines AS (
  SELECT string_agg(lower(headline), ' ') AS blob
  FROM news_stories
  WHERE first_seen >= now() - interval '30 days'
),
candidates AS (
  -- Divisions
  SELECT
    'division'::text AS event_type,
    d.id::text       AS event_id,
    d.name           AS title,
    d.date           AS event_date,
    d.chamber        AS chamber
  FROM divisions d
  WHERE d.date >= (current_date - interval '30 days')

  UNION ALL

  -- Hansard topics (best-effort; only rows with a debate_topic string)
  SELECT
    'speech'::text       AS event_type,
    h.id::text           AS event_id,
    h.debate_topic       AS title,
    h.date               AS event_date,
    h.chamber            AS chamber
  FROM hansard_speeches h
  WHERE h.date >= (current_date - interval '30 days')
    AND h.debate_topic IS NOT NULL

  UNION ALL

  -- Bills introduced recently
  SELECT
    'bill'::text              AS event_type,
    b.id::text                AS event_id,
    COALESCE(b.short_title, b.title) AS title,
    b.date_introduced         AS event_date,
    b.chamber_introduced      AS chamber
  FROM bills b
  WHERE b.date_introduced >= (current_date - interval '30 days')
)
SELECT
  c.event_type,
  c.event_id,
  c.title,
  c.event_date,
  c.chamber
FROM candidates c, recent_headlines r
WHERE
  -- Parliamentary event is a blindspot if none of its keywords show up
  -- in any recent news headline.
  NOT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(lower(c.title), '[^a-z]+') w(word)
    WHERE char_length(w.word) >= 5
      AND r.blob LIKE '%' || w.word || '%'
  )
ORDER BY c.event_date DESC;

COMMENT ON VIEW parliamentary_events_without_coverage IS
  'Divisions, Hansard debate topics, and bills from the last 30 days whose title '
  'keywords do not appear in any news_stories headline from the same period. '
  'Refreshed live on every query. Populated by client via useBlindspots until '
  'performance suggests converting to a materialised view.';


-- ── 2. mp_media_activity_gap ────────────────────────────────────────────────
-- Members who gave >= 3 speeches or cast >= 10 votes in the last 30 days but
-- whose last name does not appear in any news_stories headline in the same
-- period. This is the "working hard, getting ignored" tier of MPs.

DROP VIEW IF EXISTS mp_media_activity_gap CASCADE;

CREATE VIEW mp_media_activity_gap AS
WITH recent_headlines AS (
  SELECT string_agg(lower(headline), ' ') AS blob
  FROM news_stories
  WHERE first_seen >= now() - interval '30 days'
),
activity AS (
  SELECT
    m.id,
    m.first_name,
    m.last_name,
    m.party_id,
    (
      SELECT count(*) FROM hansard_speeches h
      WHERE h.member_id = m.id AND h.date >= (current_date - interval '30 days')
    ) AS speech_count,
    (
      SELECT count(*) FROM division_votes v
      WHERE v.member_id = m.id
        AND v.created_at >= now() - interval '30 days'
        AND v.vote_cast IN ('aye', 'no')
    ) AS vote_count
  FROM members m
  WHERE m.is_active = true
)
SELECT
  a.id,
  a.first_name,
  a.last_name,
  a.party_id,
  a.speech_count,
  a.vote_count,
  (a.speech_count + a.vote_count) AS activity_score
FROM activity a, recent_headlines r
WHERE (a.speech_count >= 3 OR a.vote_count >= 10)
  AND r.blob NOT LIKE '%' || lower(a.last_name) || '%'
ORDER BY (a.speech_count + a.vote_count) DESC;

COMMENT ON VIEW mp_media_activity_gap IS
  'MPs with substantial parliamentary activity in the last 30 days who were not '
  'mentioned by last name in any news_stories headline from the same period. '
  'The inverse of the "press gallery darlings" list.';


-- ── Notes on switching to materialised views ────────────────────────────────
-- If query planner shows these views dominating read latency, convert to
-- MATERIALIZED VIEWs and refresh on the same pg_cron schedule as the news
-- ingestion job (currently jobid 2, daily at 6am AEST):
--
--   CREATE MATERIALIZED VIEW parliamentary_events_without_coverage AS ...;
--   CREATE UNIQUE INDEX ON parliamentary_events_without_coverage(event_type, event_id);
--   REFRESH MATERIALIZED VIEW CONCURRENTLY parliamentary_events_without_coverage;
--
-- The CONCURRENTLY clause requires a unique index and keeps reads available
-- while the refresh runs.
