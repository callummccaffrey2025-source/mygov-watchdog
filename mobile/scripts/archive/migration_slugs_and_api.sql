-- Verity Public API — Slug Generation & URL Structure
-- Adds slug columns to members and bills for permanent, human-readable URLs.
-- Run: supabase db execute --project-ref zmmglikiryuftqmoprqm < scripts/migration_slugs_and_api.sql

-- ── Slug columns ─────────────────────────────────────────────────────────────

-- Members: e.g. "anthony-albanese", "penny-wong"
ALTER TABLE members ADD COLUMN IF NOT EXISTS slug text;

-- Bills: e.g. "climate-change-amendment-bill-2026"
ALTER TABLE bills ADD COLUMN IF NOT EXISTS slug text;

-- News stories: e.g. "housing-crisis-deepens-as-rates-rise"
ALTER TABLE news_stories ADD COLUMN IF NOT EXISTS slug text;

-- ── Slug generation function ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_slug(input text, max_length integer DEFAULT 80)
RETURNS text AS $$
BEGIN
  RETURN left(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(trim(input)),
          '[^a-z0-9\s-]', '', 'g'  -- remove non-alphanumeric
        ),
        '\s+', '-', 'g'            -- spaces to hyphens
      ),
      '-+', '-', 'g'               -- collapse multiple hyphens
    ),
    max_length
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Populate slugs for existing data ─────────────────────────────────────────

-- Members: first_name-last_name
UPDATE members
SET slug = generate_slug(first_name || ' ' || last_name)
WHERE slug IS NULL;

-- Handle duplicates (e.g. two "John Smith") by appending electorate
WITH dupes AS (
  SELECT slug, COUNT(*) as cnt FROM members GROUP BY slug HAVING COUNT(*) > 1
)
UPDATE members m
SET slug = generate_slug(m.first_name || ' ' || m.last_name || ' ' || COALESCE(
  (SELECT e.name FROM electorates e WHERE e.id = m.electorate_id),
  m.chamber
))
FROM dupes d
WHERE m.slug = d.slug;

-- Bills: short_title or title
UPDATE bills
SET slug = generate_slug(COALESCE(short_title, title), 80)
WHERE slug IS NULL;

-- Handle bill slug duplicates by appending year
WITH dupes AS (
  SELECT slug, COUNT(*) as cnt FROM bills WHERE slug IS NOT NULL GROUP BY slug HAVING COUNT(*) > 1
)
UPDATE bills b
SET slug = generate_slug(COALESCE(b.short_title, b.title) || ' ' || EXTRACT(YEAR FROM COALESCE(b.date_introduced, b.date, b.created_at))::text, 80)
FROM dupes d
WHERE b.slug = d.slug;

-- News stories: headline
UPDATE news_stories
SET slug = generate_slug(headline, 80)
WHERE slug IS NULL AND headline IS NOT NULL;

-- ── Indexes for slug lookups ─────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_slug ON members(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_slug ON bills(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_stories_slug ON news_stories(slug) WHERE slug IS NOT NULL;

-- ── Trigger: auto-generate slug on insert ────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_slug_member()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_slug(NEW.first_name || ' ' || NEW.last_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_slug_member ON members;
CREATE TRIGGER trg_auto_slug_member
  BEFORE INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION auto_slug_member();

CREATE OR REPLACE FUNCTION auto_slug_bill()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_slug(COALESCE(NEW.short_title, NEW.title), 80);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_slug_bill ON bills;
CREATE TRIGGER trg_auto_slug_bill
  BEFORE INSERT ON bills
  FOR EACH ROW
  EXECUTE FUNCTION auto_slug_bill();

-- ── API rate limiting table (optional) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash text NOT NULL UNIQUE,
  name text NOT NULL,
  tier text DEFAULT 'free',  -- free, journalist, pro, enterprise
  rate_limit_per_hour integer DEFAULT 100,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS api_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id uuid REFERENCES api_keys(id),
  endpoint text NOT NULL,
  status_code integer,
  response_time_ms integer,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_key_time ON api_usage(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint, created_at DESC);

-- ── URL structure reference ──────────────────────────────────────────────────
-- verity.run/mp/{slug}              → Member profile
-- verity.run/bill/{slug}            → Bill detail
-- verity.run/story/{slug}           → News story
-- verity.run/claim/{id}             → Claim verification (ClaimReview markup)
-- verity.run/poll/{id}              → Poll results
-- verity.run/electorate/{name}      → Electorate profile
-- verity.run/party/{short_name}     → Party profile
-- verity.run/api/v1/members         → JSON API
-- verity.run/api/v1/bills           → JSON API
-- verity.run/api/v1/votes           → JSON API
-- verity.run/api/v1/search          → JSON API
