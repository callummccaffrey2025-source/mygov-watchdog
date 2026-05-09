-- Audit table for news story merges
-- Never deletes merge history — every merge is recorded for forensic recovery

CREATE TABLE IF NOT EXISTS stories_merged (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_story_id uuid NOT NULL,
  target_story_id uuid NOT NULL,
  similarity numeric,
  method text NOT NULL,
  merged_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stories_merged_target ON stories_merged(target_story_id);
CREATE INDEX IF NOT EXISTS idx_stories_merged_source ON stories_merged(source_story_id);
CREATE INDEX IF NOT EXISTS idx_stories_merged_recent ON stories_merged(merged_at DESC);

ALTER TABLE stories_merged ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone reads merge audit" ON stories_merged FOR SELECT USING (true);
