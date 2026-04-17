import { test, expect } from '@playwright/test';
test('MP page renders core sections', async ({ page }) => {
  await page.goto('/mps/alba');
  await expect(page.getByRole('heading', { name: /Recent votes/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Recent news/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Committees/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Contacts & offices/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Privacy Amendment Bill/i })).toBeVisible();
});
