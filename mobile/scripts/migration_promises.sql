-- Government Promise Tracker
-- Track election promises with progress status

CREATE TABLE IF NOT EXISTS promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  source_quote text,
  source_url text,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'partially_kept', 'kept', 'broken')),
  category text,
  progress_notes text,
  related_bill_ids jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promises_status ON promises(status);
CREATE INDEX IF NOT EXISTS idx_promises_category ON promises(category) WHERE category IS NOT NULL;

-- RLS: anyone can read, only service role can write
ALTER TABLE promises ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone reads promises" ON promises FOR SELECT USING (true);

-- ── Seed data: 2025 Federal Election promises ───────────────────────────────

INSERT INTO promises (title, description, source_quote, status, category, progress_notes) VALUES
  ('Build 1.2 million homes by 2029', 'National Housing Accord target to address the housing crisis through supply-side reform.', 'We will work with states to build 1.2 million well-located homes over five years.', 'in_progress', 'Housing', 'Housing Australia Future Fund established. Supply running behind target.'),
  ('Cut power bills by $275', 'Promised average household electricity price reduction through renewables investment.', 'Our modelling shows household bills will fall by $275 by 2025.', 'broken', 'Energy', 'Wholesale prices have fallen but retail bills have not dropped by $275.'),
  ('Fee-free TAFE places', '480,000 fee-free TAFE places to address skills shortages in key sectors.', 'We will deliver 480,000 fee-free TAFE places.', 'kept', 'Education', 'Over 500,000 students have accessed fee-free TAFE since 2023.'),
  ('National Anti-Corruption Commission', 'Establish a powerful, transparent, and independent NACC.', 'A Labor government will legislate a National Anti-Corruption Commission.', 'kept', 'Integrity', 'NACC established and operational since July 2023.'),
  ('Cheaper childcare', 'Increase childcare subsidy to reduce out-of-pocket costs for families.', 'We will make childcare cheaper for more than one million families.', 'kept', 'Family', 'Childcare subsidy increased to 90% for families earning under $80k.'),
  ('Rewire the Nation', '$20 billion investment in the electricity grid to support renewable energy.', 'Rewire the Nation will rebuild and modernise Australia''s electricity grid.', 'in_progress', 'Energy', 'Funding committed. Multiple transmission projects underway.'),
  ('Pacific engagement strategy', 'Strengthen Australia''s relationships with Pacific Island nations.', 'We will reset Australia''s relationship with the Pacific.', 'partially_kept', 'Foreign Policy', 'Pacific Engagement Visa created. Some progress on climate cooperation.'),
  ('Religious Discrimination Act', 'Legislate protections against religious discrimination.', 'We will work to find common ground on religious discrimination.', 'not_started', 'Rights', 'Referred to Australian Law Reform Commission. No bill introduced.'),
  ('Closing the Gap refresh', 'New targets and commitments for Indigenous Australians.', 'We are committed to Closing the Gap in partnership with First Nations peoples.', 'in_progress', 'Indigenous Affairs', 'New targets agreed. Implementation ongoing with mixed progress.'),
  ('Strengthen Medicare', 'Tripling the bulk billing incentive to make GP visits free for more Australians.', 'We will triple the bulk billing incentive.', 'kept', 'Health', 'Bulk billing incentive tripled from November 2023.')
ON CONFLICT DO NOTHING;
