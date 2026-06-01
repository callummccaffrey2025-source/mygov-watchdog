-- bills_plain_english — rich AI-generated plain-English bill explainers
-- Populated on-demand by explain-bill Edge Function and cached per bill

CREATE TABLE IF NOT EXISTS bills_plain_english (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  summary_3line text NOT NULL,
  what_it_changes_for_you text,
  caveats text,
  model text NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bill_id)
);

CREATE INDEX IF NOT EXISTS idx_bills_plain_english_bill ON bills_plain_english(bill_id);

ALTER TABLE bills_plain_english ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bills_plain_english_read" ON bills_plain_english FOR SELECT USING (true);
