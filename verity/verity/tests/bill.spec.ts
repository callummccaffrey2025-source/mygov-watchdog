import { test, expect } from '@playwright/test';

import type { Bill } from '../src/types/bills';

type BillSummary = Pick<Bill, 'id' | 'title' | 'chamber' | 'stage' | 'source_url'> & {
  sections_count?: number | null;
};

test('bill detail renders sections when available', async ({ page, request }) => {
  const response = await request.get('/api/bills');
  await expect(response).toBeOK();
  const bills = (await response.json()) as BillSummary[];

  if (bills.length === 0) {
    test.skip(true, 'No bills available to test detail page');
  }

  const bill = bills[0];
  await page.goto(`/legislation/${bill.id}`);

  const heading = page.getByRole('heading', { level: 1 });
  if (bill.title) {
    await expect(heading).toContainText(bill.title);
  } else {
    await expect(heading).toBeVisible();
  }

  const sections = page.locator('main article section');
  const sectionCount = await sections.count();
  if (sectionCount > 0) {
    await expect(sections.first()).toBeVisible();
  } else {
    await expect(page.getByText('No sections available.')).toBeVisible();
  }
});
