-- MP Accountability Scores table
-- Stores pre-computed scores for faster loading and historical tracking

CREATE TABLE IF NOT EXISTS mp_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_id uuid NOT NULL,
  overall_score int NOT NULL,
  attendance_score int NOT NULL,
  speech_score int NOT NULL,
  voting_score int NOT NULL,
  independence_score int NOT NULL,
  question_score int NOT NULL,
  committee_score int NOT NULL,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(mp_id, calculated_at::date)
);

CREATE INDEX IF NOT EXISTS idx_mp_scores_mp ON mp_scores(mp_id, calculated_at DESC);

-- Methodology documentation (stored as a reference)
COMMENT ON TABLE mp_scores IS 'Verity Accountability Score: Attendance 25%, Speeches 20%, Voting 20%, Independence 15%, Questions 10%, Committees 10%. Calculated from APH division records, Hansard, and committee listings.';
