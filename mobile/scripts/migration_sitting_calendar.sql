-- Parliament Sitting Calendar
-- Tracks sitting days for House and Senate

CREATE TABLE IF NOT EXISTS sitting_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  chamber text NOT NULL DEFAULT 'both' CHECK (chamber IN ('house', 'senate', 'both')),
  is_sitting boolean NOT NULL DEFAULT true,
  description text,
  UNIQUE(date, chamber)
);

CREATE INDEX IF NOT EXISTS idx_sitting_calendar_date ON sitting_calendar(date);

ALTER TABLE sitting_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone reads sitting calendar" ON sitting_calendar FOR SELECT USING (true);

-- ── 2026 Parliamentary Sitting Calendar ──────────────────────────────────────
-- Source: aph.gov.au sitting calendar
-- Both chambers typically sit on the same days

-- February
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-02-03', 'both', true, 'First sitting day 2026'),
  ('2026-02-04', 'both', true, NULL),
  ('2026-02-05', 'both', true, NULL),
  ('2026-02-09', 'both', true, NULL),
  ('2026-02-10', 'both', true, NULL),
  ('2026-02-11', 'both', true, NULL),
  ('2026-02-12', 'both', true, NULL)
ON CONFLICT DO NOTHING;

-- March
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-03-16', 'both', true, NULL),
  ('2026-03-17', 'both', true, NULL),
  ('2026-03-18', 'both', true, NULL),
  ('2026-03-19', 'both', true, NULL),
  ('2026-03-23', 'both', true, NULL),
  ('2026-03-24', 'both', true, NULL),
  ('2026-03-25', 'both', true, NULL),
  ('2026-03-26', 'both', true, NULL)
ON CONFLICT DO NOTHING;

-- Budget Week (May)
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-05-11', 'both', true, 'Budget Week begins'),
  ('2026-05-12', 'both', true, 'Budget Night'),
  ('2026-05-13', 'both', true, 'Budget Reply'),
  ('2026-05-14', 'both', true, NULL),
  ('2026-05-25', 'both', true, NULL),
  ('2026-05-26', 'both', true, NULL),
  ('2026-05-27', 'both', true, NULL),
  ('2026-05-28', 'both', true, NULL)
ON CONFLICT DO NOTHING;

-- June
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-06-15', 'both', true, NULL),
  ('2026-06-16', 'both', true, NULL),
  ('2026-06-17', 'both', true, NULL),
  ('2026-06-18', 'both', true, NULL),
  ('2026-06-22', 'both', true, NULL),
  ('2026-06-23', 'both', true, NULL),
  ('2026-06-24', 'both', true, NULL),
  ('2026-06-25', 'both', true, 'Last sitting day before winter recess')
ON CONFLICT DO NOTHING;

-- August
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-08-03', 'both', true, 'Parliament resumes after winter recess'),
  ('2026-08-04', 'both', true, NULL),
  ('2026-08-05', 'both', true, NULL),
  ('2026-08-06', 'both', true, NULL),
  ('2026-08-10', 'both', true, NULL),
  ('2026-08-11', 'both', true, NULL),
  ('2026-08-12', 'both', true, NULL),
  ('2026-08-13', 'both', true, NULL)
ON CONFLICT DO NOTHING;

-- September
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-09-07', 'both', true, NULL),
  ('2026-09-08', 'both', true, NULL),
  ('2026-09-09', 'both', true, NULL),
  ('2026-09-10', 'both', true, NULL),
  ('2026-09-14', 'both', true, NULL),
  ('2026-09-15', 'both', true, NULL),
  ('2026-09-16', 'both', true, NULL),
  ('2026-09-17', 'both', true, NULL)
ON CONFLICT DO NOTHING;

-- October (Estimates)
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-10-19', 'both', true, 'Budget Estimates week 1'),
  ('2026-10-20', 'both', true, NULL),
  ('2026-10-21', 'both', true, NULL),
  ('2026-10-22', 'both', true, NULL),
  ('2026-10-26', 'both', true, 'Budget Estimates week 2'),
  ('2026-10-27', 'both', true, NULL),
  ('2026-10-28', 'both', true, NULL),
  ('2026-10-29', 'both', true, NULL)
ON CONFLICT DO NOTHING;

-- November
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-11-09', 'both', true, NULL),
  ('2026-11-10', 'both', true, NULL),
  ('2026-11-11', 'both', true, NULL),
  ('2026-11-12', 'both', true, NULL),
  ('2026-11-23', 'both', true, NULL),
  ('2026-11-24', 'both', true, NULL),
  ('2026-11-25', 'both', true, NULL),
  ('2026-11-26', 'both', true, 'Last scheduled sitting day 2026')
ON CONFLICT DO NOTHING;

-- April (current month — add for testing)
INSERT INTO sitting_calendar (date, chamber, is_sitting, description) VALUES
  ('2026-04-14', 'both', true, NULL),
  ('2026-04-15', 'both', true, NULL),
  ('2026-04-16', 'both', true, NULL)
ON CONFLICT DO NOTHING;
