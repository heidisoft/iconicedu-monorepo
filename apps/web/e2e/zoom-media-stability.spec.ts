import { expect, test } from '@playwright/test';

test('media toggles preserve unaffected video players', async ({ page }) => {
  await page.goto('/visual-test/zoom-media');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  const self = page.getByTestId('self').locator('video-player');
  const remote = page.getByTestId('remote').locator('video-player');
  await expect(self).toHaveCount(1);
  await expect(
    page.getByTestId('self').locator('[data-camera-placeholder]'),
  ).toHaveAttribute('aria-hidden', 'true');
  await expect(remote).toHaveCount(1);
  await self.evaluate((element) => element.setAttribute('data-original', 'self'));
  await remote.evaluate((element) => element.setAttribute('data-original', 'remote'));
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Toggle microphone' }).click();
    await expect(self).toHaveAttribute('data-original', 'self');
    await expect(remote).toHaveAttribute('data-original', 'remote');
  }
  await page.getByRole('button', { name: 'Toggle camera' }).click();
  await expect(self).toHaveCount(0);
  await expect(
    page.getByTestId('self').locator('[data-camera-placeholder]'),
  ).toHaveAttribute('aria-hidden', 'false');
  await expect(remote).toHaveAttribute('data-original', 'remote');
  await page.getByRole('button', { name: 'Toggle camera' }).click();
  await expect(self).toHaveCount(1);
  await expect(
    page.getByTestId('self').locator('[data-camera-placeholder]'),
  ).toHaveAttribute('aria-hidden', 'true');
  await expect(remote).toHaveAttribute('data-original', 'remote');
});
