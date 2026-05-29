/**
 * Bill Delta Engine Tests
 *
 * Verifies:
 * 1. Diff engine produces correct structured diffs
 * 2. Beneficiary detection uses keyword heuristics (not fabrication)
 * 3. Loophole flags include source spans (no flag without evidence)
 * 4. UI component uses neutral framing (no editorial language)
 * 5. No accusation of intent — only factual change detection
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('bill diff engine', () => {
  const enginePath = path.resolve(__dirname, '../scripts/bill_diff_engine.py');

  it('diff engine script exists', () => {
    expect(fs.existsSync(enginePath)).toBe(true);
  });

  it('paragraph-level diff detects added text', () => {
    const result = execSync(`python3 -c "
import sys
sys.path.insert(0, 'scripts')
from bill_diff_engine import diff_summaries
import json

old = 'First paragraph.\\nSecond paragraph.'
new = 'First paragraph.\\nInserted paragraph.\\nSecond paragraph.'
diffs = diff_summaries(old, new)
print(json.dumps(diffs))
"`, { encoding: 'utf8' }).trim();

    const diffs = JSON.parse(result);
    expect(diffs.length).toBeGreaterThan(0);
    const types = diffs.map((d: any) => d.type);
    expect(types).toContain('added');
  });

  it('paragraph-level diff detects modified text', () => {
    const result = execSync(`python3 -c "
import sys
sys.path.insert(0, 'scripts')
from bill_diff_engine import diff_summaries
import json

old = 'Applies to companies with revenue above 50 million.'
new = 'Applies to companies with revenue above 100 million.'
diffs = diff_summaries(old, new)
print(json.dumps(diffs))
"`, { encoding: 'utf8' }).trim();

    const diffs = JSON.parse(result);
    expect(diffs.length).toBeGreaterThan(0);
  });

  it('beneficiary detection matches sector keywords', () => {
    const result = execSync(`python3 -c "
import sys
sys.path.insert(0, 'scripts')
from bill_diff_engine import detect_beneficiary
import json

text = 'This amendment exempts mining companies from the environmental levy on mineral extraction.'
bens = detect_beneficiary(text)
print(json.dumps(bens))
"`, { encoding: 'utf8' }).trim();

    const bens = JSON.parse(result);
    expect(bens.length).toBeGreaterThan(0);
    expect(bens[0].sector).toBe('mining');
    // Confidence should be < 1.0 (these are heuristics, not facts)
    expect(bens[0].confidence).toBeLessThan(1.0);
  });

  it('beneficiary detection returns empty for generic text', () => {
    const result = execSync(`python3 -c "
import sys
sys.path.insert(0, 'scripts')
from bill_diff_engine import detect_beneficiary
import json

text = 'This section deals with procedural matters.'
bens = detect_beneficiary(text)
print(json.dumps(bens))
"`, { encoding: 'utf8' }).trim();

    const bens = JSON.parse(result);
    expect(bens.length).toBe(0);
  });

  it('loophole flags include source spans (no flag without evidence)', () => {
    const source = fs.readFileSync(enginePath, 'utf8');
    // detect_loophole_flags must populate source_span
    expect(source).toContain('source_span');
    expect(source).toContain('from_text');
    expect(source).toContain('to_text');
  });

  it('full delta computation produces all required fields', () => {
    const result = execSync(`python3 -c "
import sys
sys.path.insert(0, 'scripts')
from bill_diff_engine import compute_delta
import json

from_v = {
    'status_snapshot': 'introduced',
    'reading_stage': 'introduced',
    'title_snapshot': 'Test Bill 2026',
    'summary_snapshot': 'Original summary about general governance.',
    'progress_snapshot': [],
}
to_v = {
    'status_snapshot': 'passed_house',
    'reading_stage': 'third_reading',
    'title_snapshot': 'Test Bill 2026',
    'summary_snapshot': 'Updated summary about mining and mineral extraction governance.',
    'progress_snapshot': [{'stage': 'Third reading', 'chamber': 'House', 'date': '2026-05-01'}],
}
delta = compute_delta(from_v, to_v)
print(json.dumps(delta, default=str))
"`, { encoding: 'utf8' }).trim();

    const delta = JSON.parse(result);
    expect(delta.status_changed).toBe(true);
    expect(delta.summary_changed).toBe(true);
    expect(delta.change_summary).toContain('Status');
    expect(delta.changed_sections.length).toBeGreaterThan(0);
    expect(delta.source_spans.length).toBeGreaterThan(0);
    expect(delta.progress_stages_added.length).toBe(1);
    // Beneficiary should detect mining
    expect(delta.beneficiary).toBe('mining');
  });
});

describe('bill delta UI', () => {
  const componentPath = path.resolve(__dirname, '../components/BillDeltaCard.tsx');

  it('component exists', () => {
    expect(fs.existsSync(componentPath)).toBe(true);
  });

  it('uses neutral framing — no editorial language', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    // Must NOT contain accusatory language
    const forbidden = ['betrayed', 'ignored', 'corrupt', 'hypocrite', 'sneaky', 'secretly', 'suspicious'];
    for (const word of forbidden) {
      expect(source.toLowerCase()).not.toContain(word);
    }
  });

  it('beneficiary uses "may relate to" not "benefits"', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    expect(source).toContain('may relate to');
    expect(source).not.toMatch(/\bbenefits\b/);
  });

  it('includes source attribution', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    expect(source).toContain('Australian Parliament House');
  });

  it('does not use StyleSheet.create', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    expect(source).not.toContain('StyleSheet.create');
  });
});
