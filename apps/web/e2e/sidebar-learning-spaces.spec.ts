import { expect, test } from '@playwright/test';

test('student sidebar shows classes header when spaces exist', async ({ page }) => {
  const orgSlug = process.env.PLAYWRIGHT_ORG_SLUG;
  test.skip(
    !process.env.PLAYWRIGHT_AUTH_STATE || !orgSlug,
    'Set PLAYWRIGHT_AUTH_STATE and PLAYWRIGHT_ORG_SLUG to run authenticated sidebar assertions.',
  );

  await page.goto(`/${orgSlug}`);

  const learningSpaceLinks = page.locator(`a[href^='/${orgSlug}/s/']`);
  await expect(learningSpaceLinks.first()).toBeVisible();
  await expect(page.getByText('Classes')).toBeVisible();
});
