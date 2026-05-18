-- Ask Verity — Phase 1: Schema and Infrastructure
-- Applied to dev branch (azvwzfsnzopeyzxzexto) on 2026-05-18
--
-- Embeddings: Supabase built-in gte-small (384-dim, free, no external API)
-- Vector storage: pgvector HNSW index for cosine similarity
-- Generation: Claude Sonnet 4.5 via existing ANTHROPIC_API_KEY

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS civic_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN (
    'bill', 'article', 'mp_record', 'vote', 'donation',
    'inquiry', 'speech', 'party_platform', 'council_minute',
    'registered_interest', 'government_contract'
  )),
  source_id text NOT NULL,
  source_table text NOT NULL,
  source_url text,
  source_metadata jsonb DEFAULT '{}',
  chunk_index integer NOT NULL DEFAULT 0,
  chunk_text text NOT NULL,
  embedding vector(384),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS civic_embeddings_hnsw
  ON civic_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS civic_embeddings_source_type
  ON civic_embeddings(source_type);
CREATE INDEX IF NOT EXISTS civic_embeddings_source_lookup
  ON civic_embeddings(source_table, source_id);

ALTER TABLE civic_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read civic_embeddings"
  ON civic_embeddings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role write civic_embeddings"
  ON civic_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS ask_verity_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_electorate text,
  query_text text NOT NULL,
  retrieved_chunk_ids uuid[],
  answer_text text,
  refusal_pattern_used text,
  prompt_version text NOT NULL,
  model_used text NOT NULL,
  flagged boolean DEFAULT false,
  flag_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ask_verity_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own queries"
  ON ask_verity_queries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users flag own queries"
  ON ask_verity_queries FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role full access queries"
  ON ask_verity_queries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION match_civic_embeddings(
  query_embedding vector(384),
  match_count integer DEFAULT 10,
  filter_source_type text DEFAULT NULL,
  similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid, source_type text, source_id text, source_table text,
  source_url text, source_metadata jsonb, chunk_index integer,
  chunk_text text, similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT ce.id, ce.source_type, ce.source_id, ce.source_table,
    ce.source_url, ce.source_metadata, ce.chunk_index, ce.chunk_text,
    1 - (ce.embedding <=> query_embedding) as similarity
  FROM civic_embeddings ce
  WHERE ce.embedding IS NOT NULL
    AND (filter_source_type IS NULL OR ce.source_type = filter_source_type)
    AND 1 - (ce.embedding <=> query_embedding) > similarity_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;
