import { expect, test } from '@playwright/test';

test('marketing home loads and shows primary CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ICONIC Academy/i);
  await expect(page.getByRole('link', { name: /get started|dashboard|login/i }).first()).toBeVisible();
});
