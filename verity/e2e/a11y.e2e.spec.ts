import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/', '/mps'];

for (const url of pages) {
  test(`axe clean enough for ${url}`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:3000${url}`);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze();
    

    // temporary allowlist: ignore color-contrast on the homepage only
    const allowlist: Record<string,string[]> = { '/': ['color-contrast'] };
    const allowed = new Set(allowlist[url] || []);
const bad = results.violations
      .filter(v => ['serious','critical'].includes(v.impact || ''))
      .filter(v => !allowed.has(v.id));
if (bad.length) {
      console.log('axe violations:', bad.map(v => ({ id: v.id, impact: v.impact })));
    }
    expect(bad.map(v => v.id)).toEqual([]);
  });
}
