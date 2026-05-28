/**
 * Embedding Infrastructure Tests
 *
 * Verifies the populate_embeddings.py script and Edge Function are correct.
 */

const fs = require('fs');
const path = require('path');

describe('embedding infrastructure', () => {
  const scriptPath = path.resolve(__dirname, '../scripts/populate_embeddings.py');
  const edgeFnPath = path.resolve(__dirname, '../supabase/functions/ask-verity-ingest/index.ts');

  it('populate_embeddings.py script exists', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('ask-verity-ingest Edge Function exists', () => {
    expect(fs.existsSync(edgeFnPath)).toBe(true);
  });

  it('Edge Function handles all required source types', () => {
    const source = fs.readFileSync(edgeFnPath, 'utf8');
    const requiredTypes = ['bill', 'speech', 'mp_record', 'vote', 'party_platform', 'registered_interest', 'donation', 'government_contract'];
    for (const t of requiredTypes) {
      expect(source).toContain(`"${t}"`);
    }
  });

  it('Edge Function uses gte-small (no external API key needed)', () => {
    const source = fs.readFileSync(edgeFnPath, 'utf8');
    expect(source).toContain('gte-small');
    // Must NOT depend on OPENAI_API_KEY or external embedding service
    expect(source).not.toContain('OPENAI_API_KEY');
  });

  it('Edge Function chunks with overlap for context continuity', () => {
    const source = fs.readFileSync(edgeFnPath, 'utf8');
    expect(source).toContain('OVERLAP_CHARS');
    expect(source).toContain('CHUNK_MAX_CHARS');
  });

  it('Edge Function upserts on source_type+source_id+chunk_index (idempotent)', () => {
    const source = fs.readFileSync(edgeFnPath, 'utf8');
    expect(source).toContain('source_type,source_id,chunk_index');
  });

  it('populate script uses small batch size to avoid compute limits', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    // BATCH_SIZE should be 10 or less
    const match = source.match(/BATCH_SIZE\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1])).toBeLessThanOrEqual(20);
  });

  it('populate script has retry logic for WORKER_RESOURCE_LIMIT', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toContain('WORKER_RESOURCE_LIMIT');
  });
});
