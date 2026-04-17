CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS ingest_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO ingest_sources (source_key, name, base_url) VALUES
  ('aph_house', 'APH House', 'https://www.aph.gov.au'),
  ('aph_senate', 'APH Senate', 'https://www.aph.gov.au')
ON CONFLICT DO NOTHING;
