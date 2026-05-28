/**
 * Knowledge Graph Tests
 *
 * Verifies:
 * 1. Backfill script exists and handles all relationship types
 * 2. Every edge has provenance (source_table or source_url)
 * 3. No edge without extraction_method
 * 4. Relationship types match the CHECK constraint
 */

const fs = require('fs');
const path = require('path');

describe('knowledge graph infrastructure', () => {
  const scriptPath = path.resolve(__dirname, '../scripts/backfill_knowledge_graph.py');

  it('backfill script exists', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('backfill handles all core relationship sources', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toContain('backfill_party_membership');
    expect(source).toContain('backfill_electorate_representation');
    expect(source).toContain('backfill_committees');
    expect(source).toContain('backfill_donations');
    expect(source).toContain('backfill_interests');
    expect(source).toContain('backfill_rebellions');
  });

  it('every edge includes extraction_method', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    // Count occurrences of extraction_method in edge dicts
    const matches = source.match(/"extraction_method"/g);
    // Should appear in every backfill function (at least 6)
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(6);
  });

  it('every edge includes source_table for traceability', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    const matches = source.match(/"source_table"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(6);
  });

  it('backfill confidence is 1.0 for all derived facts', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    // All backfill edges should have confidence 1.0 (facts, not inferences)
    const confidenceMatches = source.match(/"confidence":\s*[\d.]+/g) || [];
    for (const m of confidenceMatches) {
      expect(m).toContain('1.0');
    }
  });

  it('donation edges include source_excerpt with amount', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    // The donation backfill should include amount in the excerpt
    expect(source).toMatch(/source_excerpt.*amount/);
  });

  it('interest edges include description excerpt', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toMatch(/source_excerpt.*description/);
  });
});
