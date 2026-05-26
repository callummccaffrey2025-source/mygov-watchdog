-- Vote × Money join infrastructure
-- 1. Ensure individual_donations has industry column
-- 2. Seed industry_topic_mapping bridge table
-- 3. Create RPC function for the cross-source join
--
-- Apply: supabase db push or paste into Supabase SQL editor

-- ── 1. Add industry to individual_donations if missing ─────────────────
ALTER TABLE individual_donations ADD COLUMN IF NOT EXISTS industry text;

-- ── 2. Seed industry → policy issue mapping ────────────────────────────
-- Maps 27 donation industries to the 10 policy_issues via their slugs.
-- A donation from industry X is relevant to divisions tagged with issue Y.
-- Many-to-many: one industry can map to multiple issues and vice versa.

TRUNCATE industry_topic_mapping;

INSERT INTO industry_topic_mapping (industry, related_topics, keywords) VALUES
  ('gambling',            ARRAY['health', 'integrity'],                          ARRAY['gambling', 'wagering', 'pokies']),
  ('mining',              ARRAY['climate', 'tax', 'cost-of-living'],             ARRAY['mining', 'resources', 'minerals']),
  ('fossil_fuels',        ARRAY['climate', 'cost-of-living'],                    ARRAY['oil', 'gas', 'petroleum', 'lng']),
  ('energy',              ARRAY['climate', 'cost-of-living'],                    ARRAY['energy', 'electricity', 'solar', 'renewable']),
  ('property',            ARRAY['housing', 'cost-of-living'],                    ARRAY['property', 'real estate', 'construction']),
  ('finance',             ARRAY['tax', 'housing', 'cost-of-living', 'integrity'],ARRAY['banking', 'finance', 'insurance']),
  ('lobbying',            ARRAY['integrity'],                                    ARRAY['lobbying', 'government relations']),
  ('legal',               ARRAY['integrity'],                                    ARRAY['law', 'legal']),
  ('hospitality',         ARRAY['immigration', 'cost-of-living'],                ARRAY['hotel', 'tourism', 'hospitality']),
  ('media',               ARRAY['integrity'],                                    ARRAY['media', 'news', 'broadcast']),
  ('unions',              ARRAY['cost-of-living', 'education', 'health'],        ARRAY['union', 'workers']),
  ('telecom',             ARRAY['cost-of-living'],                               ARRAY['telecom', 'broadband', 'nbn']),
  ('pharmacy',            ARRAY['health'],                                       ARRAY['pharma', 'medicine', 'therapeutic']),
  ('health',              ARRAY['health', 'aged-care'],                          ARRAY['hospital', 'health fund', 'medical']),
  ('alcohol',             ARRAY['health'],                                       ARRAY['alcohol', 'liquor', 'brewery']),
  ('tobacco',             ARRAY['health'],                                       ARRAY['tobacco']),
  ('tech',                ARRAY['cost-of-living', 'education'],                  ARRAY['tech', 'software', 'digital']),
  ('agriculture',         ARRAY['climate', 'cost-of-living'],                    ARRAY['agriculture', 'farm', 'grain']),
  ('retail',              ARRAY['cost-of-living'],                               ARRAY['retail', 'supermarket']),
  ('defence',             ARRAY['defence'],                                      ARRAY['defence', 'military', 'arms']),
  ('transport',           ARRAY['climate', 'cost-of-living'],                    ARRAY['aviation', 'transport', 'shipping']),
  ('education',           ARRAY['education'],                                    ARRAY['university', 'school', 'training']),
  ('party_internal',      ARRAY[]::text[],                                       ARRAY['party']),
  ('government',          ARRAY[]::text[],                                       ARRAY['government']),
  ('security',            ARRAY['defence'],                                      ARRAY['security']),
  ('waste_management',    ARRAY['climate'],                                      ARRAY['waste', 'recycling']),
  ('adult_entertainment', ARRAY[]::text[],                                       ARRAY['adult']);

-- ── 3. RPC: get vote-money links for a member ──────────────────────────
-- Returns: for each division a member voted on, any donation industries
-- that map to policy issues tagged on that division.
-- This is the Vote × Money join.

CREATE OR REPLACE FUNCTION get_vote_money_links(
  p_member_id uuid,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  division_id text,
  division_name text,
  division_date date,
  vote_cast text,
  issue_slug text,
  issue_name text,
  aye_supports boolean,
  donation_industry text,
  industry_total_amount numeric,
  industry_donor_count bigint,
  top_donor_name text,
  top_donor_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH member_party AS (
    SELECT party_id FROM members WHERE id = p_member_id
  ),
  -- Get all divisions this member voted on
  member_votes AS (
    SELECT
      dv.division_id,
      dv.vote_cast,
      d.name AS division_name,
      d.date AS division_date
    FROM division_votes dv
    JOIN divisions d ON d.id = dv.division_id
    WHERE dv.member_id = p_member_id
  ),
  -- Get issue tags on those divisions (confidence >= 0.6)
  tagged_votes AS (
    SELECT
      mv.*,
      dit.issue_id,
      pi.slug AS issue_slug,
      pi.name AS issue_name,
      dit.aye_supports
    FROM member_votes mv
    JOIN division_issue_tags dit ON dit.division_id = mv.division_id
      AND dit.confidence >= 0.6
    JOIN policy_issues pi ON pi.id = dit.issue_id
  ),
  -- Map issues → industries via bridge table
  vote_industry AS (
    SELECT DISTINCT
      tv.*,
      itm.industry AS donation_industry
    FROM tagged_votes tv
    JOIN industry_topic_mapping itm ON tv.issue_slug = ANY(itm.related_topics)
    WHERE itm.industry NOT IN ('party_internal', 'government')
  ),
  -- Aggregate donations per industry (individual + party level)
  industry_donations AS (
    SELECT
      vi.division_id,
      vi.donation_industry,
      COALESCE(ind.total, 0) + COALESCE(pty.total, 0) AS total_amount,
      COALESCE(ind.cnt, 0) + COALESCE(pty.cnt, 0) AS donor_count,
      COALESCE(ind.top_name, pty.top_name) AS top_donor_name,
      GREATEST(COALESCE(ind.top_amount, 0), COALESCE(pty.top_amount, 0)) AS top_donor_amount
    FROM (SELECT DISTINCT division_id, donation_industry FROM vote_industry) vi
    LEFT JOIN LATERAL (
      SELECT
        SUM(amount) AS total,
        COUNT(DISTINCT donor_name) AS cnt,
        (SELECT donor_name FROM individual_donations
         WHERE member_id = p_member_id AND industry = vi.donation_industry
         ORDER BY amount DESC LIMIT 1) AS top_name,
        MAX(amount) AS top_amount
      FROM individual_donations
      WHERE member_id = p_member_id
        AND industry = vi.donation_industry
    ) ind ON true
    LEFT JOIN LATERAL (
      SELECT
        SUM(amount) AS total,
        COUNT(DISTINCT donor_name) AS cnt,
        (SELECT donor_name FROM donations
         WHERE party_id = (SELECT party_id FROM member_party)
           AND industry = vi.donation_industry
         ORDER BY amount DESC LIMIT 1) AS top_name,
        MAX(amount) AS top_amount
      FROM donations
      WHERE party_id = (SELECT party_id FROM member_party)
        AND industry = vi.donation_industry
    ) pty ON true
    WHERE COALESCE(ind.total, 0) + COALESCE(pty.total, 0) > 0
  )
  SELECT
    vi.division_id,
    vi.division_name,
    vi.division_date,
    vi.vote_cast,
    vi.issue_slug,
    vi.issue_name,
    vi.aye_supports,
    vi.donation_industry,
    id.total_amount AS industry_total_amount,
    id.donor_count AS industry_donor_count,
    id.top_donor_name,
    id.top_donor_amount
  FROM vote_industry vi
  JOIN industry_donations id ON id.division_id = vi.division_id
    AND id.donation_industry = vi.donation_industry
  ORDER BY vi.division_date DESC, id.total_amount DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 4. Summary RPC: top industries for a member's voting conflicts ─────
-- Lighter query: "which industries donated most to this MP/party,
-- and how many related votes did they cast?"

CREATE OR REPLACE FUNCTION get_vote_money_summary(
  p_member_id uuid
)
RETURNS TABLE (
  donation_industry text,
  total_amount numeric,
  donor_count bigint,
  related_vote_count bigint,
  top_donor_name text,
  sample_division_name text
) AS $$
BEGIN
  RETURN QUERY
  WITH member_party AS (
    SELECT party_id FROM members WHERE id = p_member_id
  ),
  -- All industries with donations (individual + party)
  all_donations AS (
    SELECT industry, SUM(amount) AS total, COUNT(DISTINCT donor_name) AS cnt,
           (array_agg(donor_name ORDER BY amount DESC))[1] AS top_name
    FROM (
      SELECT industry, amount, donor_name
      FROM individual_donations WHERE member_id = p_member_id AND industry IS NOT NULL
      UNION ALL
      SELECT industry, amount, donor_name
      FROM donations WHERE party_id = (SELECT party_id FROM member_party) AND industry IS NOT NULL
    ) combined
    WHERE industry NOT IN ('party_internal', 'government', 'individual', 'unidentified')
    GROUP BY industry
  ),
  -- Count related votes per industry
  vote_counts AS (
    SELECT
      itm.industry,
      COUNT(DISTINCT dv.division_id) AS vote_count,
      (array_agg(d.name ORDER BY d.date DESC))[1] AS sample_division
    FROM industry_topic_mapping itm
    JOIN division_issue_tags dit ON dit.confidence >= 0.6
      AND (SELECT slug FROM policy_issues WHERE id = dit.issue_id) = ANY(itm.related_topics)
    JOIN division_votes dv ON dv.division_id = dit.division_id
      AND dv.member_id = p_member_id
    JOIN divisions d ON d.id = dv.division_id
    GROUP BY itm.industry
  )
  SELECT
    ad.industry AS donation_industry,
    ad.total AS total_amount,
    ad.cnt AS donor_count,
    COALESCE(vc.vote_count, 0) AS related_vote_count,
    ad.top_name AS top_donor_name,
    vc.sample_division AS sample_division_name
  FROM all_donations ad
  LEFT JOIN vote_counts vc ON vc.industry = ad.industry
  WHERE COALESCE(vc.vote_count, 0) > 0
  ORDER BY ad.total DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;
