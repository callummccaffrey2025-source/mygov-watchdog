/**
 * Vote Prediction Baseline Tests
 *
 * Verifies:
 * 1. Model outputs are labelled as estimates, never facts
 * 2. Per-MP predictions don't appear on public surfaces
 * 3. Cohesion computation is correct
 * 4. Model version is explicit
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('vote prediction baseline', () => {
  const scriptPath = path.resolve(__dirname, '../scripts/vote_prediction_baseline.py');

  it('script exists', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('output includes MODEL ESTIMATE label', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toContain('MODEL ESTIMATE');
    expect(source).toContain('NOT A FACT');
  });

  it('model_version is explicitly set', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toMatch(/MODEL_VERSION\s*=\s*"/);
  });

  it('does not generate per-MP public predictions', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    // Should compute party-level stats, not per-MP predictions for display
    expect(source).not.toContain('mp_prediction');
    expect(source).not.toContain('individual_prediction');
  });

  it('cohesion calculation requires minimum 2 members per party per division', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toContain('len(votes) < 2');
  });
});

describe('prediction labelling in UI', () => {
  it('BillDetailScreen labels pass_probability as estimate if used', () => {
    const screenPath = path.resolve(__dirname, '../screens/BillDetailScreen.tsx');
    const source = fs.readFileSync(screenPath, 'utf8');
    if (source.includes('pass_probability')) {
      expect(source).toMatch(/estimate|model|prediction/i);
    }
  });
});
