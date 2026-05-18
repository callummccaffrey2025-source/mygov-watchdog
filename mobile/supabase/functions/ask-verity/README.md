# Ask Verity — Architecture Reference

Non-partisan civic AI Q&A for Australian democracy. Answers grounded strictly in Verity's primary-source database.

Last updated: 2026-05-18 (Phase 1)

---

## Seven Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **1. Schema** | **DONE** | pgvector enabled, `civic_embeddings` + `ask_verity_queries` tables on dev branch |
| 2. Ingestion | Pending | Chunk and embed all political data (bills, hansard, votes, donations, MPs, policies) |
| 3. Retrieval | Pending | Edge Function: embed query → vector search → return ranked chunks with metadata |
| 4. Generation | Pending | Edge Function: retrieved chunks + system prompt → Claude Sonnet 4.5 → cited answer |
| 5. Evaluation | Pending | 50-question eval harness. **Gates deployment — must pass ≥95%** |
| 6. Mobile UI | Pending | AskScreen chat interface with citation chips, flagging, suggested questions |
| 7. Polish | Pending | Sharing, election-period mode, analytics dashboard, daily-question integration |

## Retrieval Strategy

**Hybrid vector + structured filters:**

1. User question → embed via Supabase built-in `gte-small` (384-dim, free, no external API)
2. KNN search against `civic_embeddings` using pgvector HNSW index (top 10 chunks)
3. If query contains personal markers ("my MP", "my electorate"), boost results from user's electorate via `source_metadata` filter
4. Return chunks with full source metadata for citation rendering

## Embedding Model

**Supabase Edge Runtime built-in `gte-small`** (384 dimensions)
- Free — runs on Supabase infrastructure, no external API key
- Available via `new Supabase.ai.Session('gte-small')` in Edge Functions
- Produces Float32Array(384) embeddings
- Stored in pgvector `vector(384)` column with HNSW cosine index

## Generation Model

**Claude Sonnet 4.5** (`claude-sonnet-4-5`) via Anthropic API
- Key: `ANTHROPIC_API_KEY` (already in Supabase Vault)
- Haiku may be tested for cost optimization after Phase 5 evaluation passes

## System Prompt

Location: the master prompt spec (Appendix A) lives in the Phase 1 prompt that initiated this feature. It is embedded **verbatim** in Phase 4 — no paraphrasing, no trimming.

Key properties:
- Non-partisan: symmetry test across all parties
- Source-disciplined: every claim must cite a chunk from `retrieved_context`
- Named refusal patterns: `character_question_redirect`, `voting_advice_redirect`, `prediction_refusal`, `defamation_refusal`, `values_question_redirect`, `cite_authority`, `no_data_response`, `meta_question_response`
- No preamble, no emoji, Australian English

## Prompt Versioning

- `ask_verity_queries.prompt_version` tracks which prompt version generated each answer
- Start at `"v0.1"` in Phase 4
- Increment on any system prompt change
- Old versions preserved in git history for audit

## Evaluation Harness (Phase 5)

- 50-question test set covering every refusal pattern × every party
- Scoring: correct refusal, all claims cited, symmetry test, no character judgments, no voting advice, no predictions, honest "no records"
- **Deployment blocked if pass rate < 95%**

## Flagging Flow

1. User taps flag button on any Verity answer
2. Client writes `flagged = true` + `flag_reason` to `ask_verity_queries`
3. Callum triages flagged answers weekly via admin query
4. Findings feed back into prompt refinement and eval set expansion

## Database Schema (dev branch)

### `civic_embeddings`
- `id` uuid PK
- `source_type` text (bill, article, mp_record, vote, donation, inquiry, speech, party_platform, council_minute, registered_interest, government_contract)
- `source_id` text — FK to source table row
- `source_table` text — which Supabase table the source lives in
- `source_url` text — link to original document
- `source_metadata` jsonb — title, MP name, party, date, etc.
- `chunk_index` integer — position within a multi-chunk document
- `chunk_text` text — the actual text chunk (≤800 tokens)
- `embedding` vector(384) — gte-small embedding
- HNSW index on embedding (cosine)

### `ask_verity_queries`
- `id` uuid PK
- `user_id` uuid — nullable (anon users)
- `user_electorate` text
- `query_text` text
- `retrieved_chunk_ids` uuid[] — which chunks were used
- `answer_text` text
- `refusal_pattern_used` text — null if in-scope answer
- `prompt_version` text (e.g. "v0.1")
- `model_used` text (e.g. "claude-sonnet-4-5")
- `flagged` boolean
- `flag_reason` text
- `created_at` timestamptz

## Source Tables (production — referenced by civic_embeddings.source_table)

| source_type | source_table | Row count | Chunking strategy |
|-------------|-------------|-----------|-------------------|
| bill | bills | 6,244 | Section boundaries, summary + expanded_summary |
| speech | hansard_entries | 4,780 | Division boundaries, ≤800 tokens |
| government_contract | government_contracts | 4,851 | One chunk per contract |
| donation | individual_donations | 2,307 | One chunk per donation record |
| registered_interest | registered_interests | 1,753 | One chunk per interest |
| mp_record | members | 225 | Bio + role + committees |
| party_platform | party_policies | 40 | One chunk per policy section |
| vote | divisions + division_votes | 2,006 divisions | Summary per division with vote breakdown |
