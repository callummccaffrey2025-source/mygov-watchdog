-- Bill change history
-- Records every status transition for audit, history view, and notifications

CREATE TABLE IF NOT EXISTS bill_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  change_description text,
  changed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_changes_bill ON bill_changes(bill_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_changes_recent ON bill_changes(changed_at DESC);

ALTER TABLE bill_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone reads bill changes" ON bill_changes FOR SELECT USING (true);

-- ── Trigger to auto-record status changes ──────────────────────────────────
-- Fires when current_status changes on the bills table

CREATE OR REPLACE FUNCTION record_bill_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_status IS DISTINCT FROM OLD.current_status THEN
    INSERT INTO bill_changes (bill_id, previous_status, new_status, change_description, changed_at)
    VALUES (
      NEW.id,
      OLD.current_status,
      NEW.current_status,
      'Status changed from "' || COALESCE(OLD.current_status, 'new') || '" to "' || NEW.current_status || '"',
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bill_status_change_trigger ON bills;
CREATE TRIGGER bill_status_change_trigger
  AFTER UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION record_bill_status_change();

-- ── Backfill: seed initial status for existing bills ────────────────────────
-- Creates an initial "Introduced" change record for bills that don't have any history

INSERT INTO bill_changes (bill_id, previous_status, new_status, change_description, changed_at)
SELECT
  b.id,
  NULL,
  b.current_status,
  'Bill introduced',
  COALESCE(b.date_introduced::timestamptz, b.last_updated, now())
FROM bills b
WHERE b.current_status IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bill_changes bc WHERE bc.bill_id = b.id)
  AND b.current_status != 'In search index';
