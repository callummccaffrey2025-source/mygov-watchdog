import { test, expect } from '@playwright/test';

test('legislation page lists bills or empty state', async ({ page }) => {
  await page.goto('/legislation');
  const listItems = page.locator('main ul li');
  const count = await listItems.count();
  if (count > 0) {
    await expect(listItems.first()).toBeVisible();
  } else {
    await expect(page.getByText('No bills found.')).toBeVisible();
  }
});
