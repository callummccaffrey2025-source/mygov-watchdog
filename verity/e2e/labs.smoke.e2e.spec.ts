import { test, expect } from '@playwright/test';

const routes = [
  ['/labs', /Labs/],
  ['/labs/bias-compass', /Bias Compass/i],
  ['/labs/simulator', /Legislation Impact Simulator/i],
  ['/labs/heatmaps', /Accountability Heatmaps/i],
  ['/labs/assistant', /Civic Assistant/i],
  ['/labs/timelines', /Receipts Timeline/i],
  ['/labs/petitions', /Citizen Petition Engine/i],
  ['/labs/benchmarks', /Global Benchmarks/i],
  ['/labs/influence', /MP Influence Score/i],
  ['/labs/trust', /Trust Index/i],
  ['/labs/vault', /Verity Vault/i],
];

for (const [path, rx] of routes) {
  test(`loads ${path}`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:3000${path}`);
    await expect(page.getByRole('heading', { name: rx })).toBeVisible();
  });
}
