-- Official Posts table for MP statements, media releases, and announcements
-- Run this against your Supabase project

CREATE TABLE IF NOT EXISTS official_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid REFERENCES members(id) NOT NULL,
  author_type text DEFAULT 'member',
  content text NOT NULL,
  post_type text DEFAULT 'update',   -- 'update', 'announcement', 'opinion', 'event', 'policy', 'media_release'
  media_urls text[],
  bill_id uuid REFERENCES bills(id),
  electorate_id uuid REFERENCES electorates(id),
  link_url text,
  is_pinned boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  dislikes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_official_posts_author ON official_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_official_posts_created ON official_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_official_posts_electorate ON official_posts(electorate_id);

-- Enable RLS
ALTER TABLE official_posts ENABLE ROW LEVEL SECURITY;

-- Allow read access to all
CREATE POLICY IF NOT EXISTS "official_posts_read_all"
  ON official_posts FOR SELECT USING (true);
