import { test, expect } from '@playwright/test';

test('home loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('news page renders', async ({ page }) => {
  await page.goto('/news');
  await expect(page.getByRole('heading', { level: 1, name: /news/i })).toBeVisible();
});
