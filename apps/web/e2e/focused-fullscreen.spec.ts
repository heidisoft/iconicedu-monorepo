import { test, expect } from '@playwright/test';

test('focuses one camera without remounting the renderer or showing tile badges', async ({
  page,
}) => {
  await page.goto('/visual-test/zoom-media');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  const self = page.getByTestId('self');
  await self.locator('video-player').evaluate((node) => {
    (node as HTMLElement).dataset.identity = 'live-camera';
  });
  await self
    .getByRole('button', { name: 'View Self video fullscreen', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fullscreenElement?.getAttribute('data-focused-content'),
      ),
    )
    .toBe('video');
  await expect(self.getByLabel('Self status')).toBeHidden();
  await expect(self.locator('video-player')).toHaveAttribute(
    'data-identity',
    'live-camera',
  );
  const size = await self.locator('[data-focused-content]').boundingBox();
  expect(size!.width).toBe(1280);
  expect(size!.height).toBe(720);
  await self.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(self.getByLabel('Self status')).toBeVisible();
  await expect(self.locator('video-player')).toHaveAttribute(
    'data-identity',
    'live-camera',
  );
});

for (const mode of ['remote', 'local', 'whiteboard'] as const) {
  test(`focuses ${mode} content and restores it without losing state`, async ({
    page,
  }) => {
    await page.goto('/visual-test/focused-fullscreen');
    await page.getByRole('button', { name: `Show ${mode}`, exact: true }).click();
    const label = mode === 'whiteboard' ? 'whiteboard' : 'shared screen';
    const selector =
      mode === 'whiteboard'
        ? '[data-focused-content="whiteboard"]'
        : `[data-focused-content="share"][aria-hidden="false"]`;
    const surface = page.locator(selector);
    const content =
      mode === 'whiteboard'
        ? surface.getByTestId('live-whiteboard')
        : surface.locator('canvas[data-share-source]');
    await content.evaluate((node) => {
      (node as HTMLElement).dataset.identity = 'live-content';
    });
    if (mode === 'whiteboard')
      await page.getByLabel('Whiteboard draft').fill('Keep my work');
    await page
      .getByRole('button', { name: `View ${label} fullscreen`, exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.fullscreenElement?.getAttribute('data-focused-content'),
        ),
      )
      .toBe(mode === 'whiteboard' ? 'whiteboard' : 'share');
    const navigationIsOutside = await page.evaluate(
      () =>
        !document.fullscreenElement?.contains(
          document.querySelector('[data-testid="call-navigation"]'),
        ) &&
        !document.fullscreenElement?.contains(
          document.querySelector('[data-testid="participant-strip"]'),
        ),
    );
    expect(navigationIsOutside).toBe(true);
    await expect(content).toHaveAttribute('data-identity', 'live-content');
    if (mode === 'whiteboard') {
      await expect(page.getByTestId('whiteboard-board-details')).toBeVisible();
      await expect(page.getByTestId('whiteboard-overlay-toolbar')).toBeVisible();
    } else {
      await expect(surface.getByRole('tablist')).toBeHidden();
      const toolbar = surface.getByRole('toolbar', { name: 'Screen annotations' });
      await expect(toolbar).toBeVisible();
      await toolbar.getByRole('button', { name: 'Pen', exact: true }).click();
      await toolbar.getByRole('button', { name: 'Format', exact: true }).click();
      await expect(surface.locator('[data-annotation-panel]')).toBeVisible();
      await surface.getByRole('button', { name: 'Close Format', exact: true }).click();
    }
    await surface.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(content).toHaveAttribute('data-identity', 'live-content');
    if (mode === 'whiteboard')
      await expect(page.getByLabel('Whiteboard draft')).toHaveValue('Keep my work');
  });
}

test('leaves focused fullscreen when the active share ends', async ({ page }) => {
  await page.goto('/visual-test/focused-fullscreen');
  await page
    .getByRole('button', { name: 'View shared screen fullscreen', exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  // Simulate an SDK event rather than clicking controls outside the fullscreen surface.
  await page
    .getByRole('button', { name: 'Show none', exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});
