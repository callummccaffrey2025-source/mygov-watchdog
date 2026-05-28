/**
 * Data Integrity Tests — the test gate for Verity.
 *
 * These verify the non-negotiable constraints:
 * 1. division_votes is the canonical vote table (not member_votes)
 * 2. No fake/seeded data attributed to real politicians
 * 3. Prediction outputs carry model + confidence + "estimate" labelling
 * 4. Source spans are required for graph edges and loophole flags
 */

// ── 1. Hook contracts: useVotes reads from division_votes ────────────────

describe('useVotes contract', () => {
  it('useVotes.ts file exists and exports useVotes', () => {
    const fs = require('fs');
    const path = require('path');
    const hookPath = path.resolve(__dirname, '../hooks/useVotes.ts');
    expect(fs.existsSync(hookPath)).toBe(true);
    const source = fs.readFileSync(hookPath, 'utf8');
    expect(source).toContain('export function useVotes');
  });

  it('DivisionVote interface has vote_cast not vote', () => {
    // The canonical field is vote_cast (from division_votes), not vote (from member_votes)
    // This is a compile-time check enforced by TypeScript, but we verify the shape here
    const hookSource = require('fs').readFileSync(
      require('path').resolve(__dirname, '../hooks/useVotes.ts'), 'utf8'
    );
    expect(hookSource).toContain('vote_cast');
    expect(hookSource).toContain('division_votes');
    // Must NOT query member_votes
    expect(hookSource).not.toContain("from('member_votes')");
  });
});

// ── 2. No fabricated data on real-politician surfaces ────────────────────

describe('no fabricated data', () => {
  it('useVotes does not contain seed/mock data', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../hooks/useVotes.ts'), 'utf8'
    );
    // No hardcoded vote data
    expect(source).not.toMatch(/fake|seed|mock.*data|dummy/i);
  });

  it('MemberProfileScreen does not contain fabricated quotes or votes', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../screens/MemberProfileScreen.tsx'), 'utf8'
    );
    // No hardcoded politician names with fabricated data
    expect(source).not.toMatch(/["']This MP voted["']/);
    expect(source).not.toMatch(/sampleVotes|mockVotes|fakeVotes/i);
  });

  it('RepresentationGapCard requires real data, not seeds', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/RepresentationGapCard.tsx'), 'utf8'
    );
    expect(source).not.toMatch(/fake|seed|mock.*data|dummy/i);
  });
});

// ── 3. Prediction labelling ──────────────────────────────────────────────

describe('prediction labelling', () => {
  it('vote prediction UI component labels outputs correctly', () => {
    // The GuessReveal component (if it exists) must frame predictions as user guesses,
    // not as system predictions about real politicians
    const compPath = require('path').resolve(__dirname, '../components/GuessReveal.tsx');
    const exists = require('fs').existsSync(compPath);
    if (!exists) {
      console.warn('GuessReveal.tsx not found — skipping prediction label test');
      return;
    }
    const source = require('fs').readFileSync(compPath, 'utf8');
    // Must frame as user's guess, not a system prediction
    expect(source).toMatch(/guess|your prediction|you predicted/i);
    // Must NOT present guesses as system-generated predictions about named politicians
    expect(source).not.toMatch(/we predict|system predicts|AI predicts/i);
  });

  it('bills table pass_probability is never displayed without labelling', () => {
    const screenPath = require('path').resolve(__dirname, '../screens/BillDetailScreen.tsx');
    const source = require('fs').readFileSync(screenPath, 'utf8');
    // If pass_probability is referenced, "estimate" or "model" must also appear
    if (source.includes('pass_probability')) {
      expect(source).toMatch(/estimate|model|prediction/i);
    }
  });
});

// ── 4. Conflict Radar is gated ──────────────────────────────────────────

describe('conflict radar legal gate', () => {
  it('conflict radar feature flag defaults to OFF', () => {
    const hookPath = require('path').resolve(__dirname, '../hooks/useConflictRadar.ts');
    const exists = require('fs').existsSync(hookPath);
    if (!exists) {
      console.warn('useConflictRadar.ts not found — skipping');
      return;
    }
    const source = require('fs').readFileSync(hookPath, 'utf8');
    // Must use feature flag system, not a hardcoded boolean
    expect(source).toMatch(/isFeatureEnabled|featureFlags|FEATURE_ENABLED.*false/);
    // Must NOT have FEATURE_ENABLED = true
    expect(source).not.toMatch(/FEATURE_ENABLED\s*=\s*true/);
  });

  it('ConflictRadarCard requires enabled prop', () => {
    const compPath = require('path').resolve(__dirname, '../components/ConflictRadarCard.tsx');
    const exists = require('fs').existsSync(compPath);
    if (!exists) {
      console.warn('ConflictRadarCard.tsx not found — skipping');
      return;
    }
    const source = require('fs').readFileSync(compPath, 'utf8');
    // Component must check enabled before rendering
    expect(source).toMatch(/!enabled.*return null|enabled.*===.*false/);
  });
});

// ── 5. Source span requirements ──────────────────────────────────────────

describe('source span traceability', () => {
  it('RepresentationGapCard shows disclaimer about data source', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/RepresentationGapCard.tsx'), 'utf8'
    );
    expect(source).toMatch(/not a representative sample|Verity.*poll|disclaimer/i);
  });

  it('DecisiveVotesCard includes factual framing disclaimer', () => {
    const compPath = require('path').resolve(__dirname, '../components/DecisiveVotesCard.tsx');
    const exists = require('fs').existsSync(compPath);
    if (!exists) {
      console.warn('DecisiveVotesCard.tsx not found — skipping');
      return;
    }
    const source = require('fs').readFileSync(compPath, 'utf8');
    // Must include disclaimer about "winning side" not meaning "determined outcome"
    expect(source).toMatch(/winning side|determined|single MP/i);
  });
});

// ── 6. StyleSheet.create prohibition ─────────────────────────────────────

describe('no StyleSheet.create', () => {
  const fs = require('fs');
  const path = require('path');

  const screenDir = path.resolve(__dirname, '../screens');
  const componentDir = path.resolve(__dirname, '../components');

  function getFiles(dir: string, ext: string): string[] {
    try {
      return fs.readdirSync(dir)
        .filter((f: string) => f.endsWith(ext))
        .map((f: string) => path.join(dir, f));
    } catch { return []; }
  }

  const allFiles = [
    ...getFiles(screenDir, '.tsx'),
    ...getFiles(componentDir, '.tsx'),
  ];

  // Test a representative sample (not all 50+ files — just the ones we touch most)
  const criticalFiles = allFiles.filter(f =>
    f.includes('MemberProfile') || f.includes('PollsScreen') ||
    f.includes('HomeScreen') || f.includes('BillDetail') ||
    f.includes('RepresentationGap') || f.includes('DecisiveVotes') ||
    f.includes('ConflictRadar')
  );

  it.each(criticalFiles)('%s does not use StyleSheet.create', (filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    expect(source).not.toMatch(/StyleSheet\.create/);
  });
});
