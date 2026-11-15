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

for (const mode of ['remote', 'local', 'whiteboard'] as const) {
  test(`shows movable participant videos in ${mode} fullscreen without replacing players`, async ({
    page,
  }) => {
    await page.goto('/visual-test/focused-fullscreen');
    await page.getByRole('button', { name: `Show ${mode}`, exact: true }).click();
    const players = page.locator('video-player');
    await expect(players).toHaveCount(3);
    await players.first().evaluate((node) => {
      (window as unknown as { retainedPlayer: Element }).retainedPlayer = node;
    });
    const label = mode === 'whiteboard' ? 'whiteboard' : 'shared screen';
    await page
      .getByRole('button', { name: `View ${label} fullscreen`, exact: true })
      .click();
    const fullscreen = page.locator('[data-focused-content]:fullscreen');
    await expect(
      fullscreen.getByRole('button', { name: 'Show participants', exact: true }),
    ).toBeVisible();
    const overlay = fullscreen.getByRole('region', { name: 'Fullscreen participants' });
    await expect(overlay).toBeHidden();
    await fullscreen
      .getByRole('button', { name: 'Show participants', exact: true })
      .click();
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText('Speaker one', { exact: true })).toBeVisible();
    await expect(overlay.getByText('Speaker two', { exact: true })).toBeHidden();
    await expect(overlay.getByText('Self (You)', { exact: true })).toBeVisible();
    await overlay.getByRole('button', { name: 'Hide self-view', exact: true }).click();
    await expect(overlay.getByText('Self (You)', { exact: true })).toBeHidden();
    await overlay.getByRole('button', { name: 'Show self-view', exact: true }).click();
    await page
      .getByRole('button', { name: 'Change speaker', exact: true })
      .evaluate((node: HTMLButtonElement) => node.click());
    await expect(overlay.getByText('Speaker two', { exact: true })).toBeVisible();
    await expect(overlay.getByText('Speaker one', { exact: true })).toBeHidden();
    const start = (await overlay.boundingBox())!;
    const handle = overlay.getByRole('button', { name: 'Move participant videos' });
    await handle.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await overlay.boundingBox())!.x).toBeLessThan(start.x);
    const grip = (await handle.boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, 120, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await overlay.boundingBox())!.x).toBeLessThan(100);
    await overlay
      .getByRole('button', { name: 'Hide participant videos', exact: true })
      .click();
    await expect(overlay).toBeHidden();
    await fullscreen
      .getByRole('button', { name: 'Show participants', exact: true })
      .click();
    await expect(overlay).toBeVisible();
    expect(
      await page.evaluate(() =>
        document.contains(
          (window as unknown as { retainedPlayer: Element }).retainedPlayer,
        ),
      ),
    ).toBe(true);
    await fullscreen
      .getByRole('button', { name: 'Exit fullscreen', exact: true })
      .click();
    await expect(page.getByText('Speaker one', { exact: true })).toBeVisible();
    await expect(page.getByText('Speaker two', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() =>
        document.contains(
          (window as unknown as { retainedPlayer: Element }).retainedPlayer,
        ),
      ),
    ).toBe(true);
    await expect(players).toHaveCount(3);
  });
}

test('keeps fullscreen video controls reachable on small and resized displays', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/visual-test/focused-fullscreen');
  await page
    .getByRole('button', { name: 'View shared screen fullscreen', exact: true })
    .click();
  const fullscreen = page.locator('[data-focused-content]:fullscreen');
  await fullscreen
    .getByRole('button', { name: 'Show participants', exact: true })
    .click();
  const overlay = fullscreen.getByRole('region', { name: 'Fullscreen participants' });
  const handle = overlay.getByRole('button', { name: 'Move participant videos' });
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  const browser = await page.context().newCDPSession(page);
  for (const viewport of [
    { width: 740, height: 360 },
    { width: 320, height: 568 },
  ]) {
    // Browser windows cannot be resized while fullscreen; emulate viewport changes
    // directly to exercise the same resize path used by display/orientation changes.
    await browser.send('Emulation.setDeviceMetricsOverride', {
      ...viewport,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await expect
      .poll(async () => {
        const bounds = (await overlay.boundingBox())!;
        return (
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= viewport.width &&
          bounds.y + bounds.height <= viewport.height - 40
        );
      })
      .toBe(true);
    await expect(
      fullscreen.getByRole('button', { name: 'Hide participants', exact: true }),
    ).toBeInViewport();
    await expect(
      fullscreen.getByRole('button', { name: 'Exit fullscreen', exact: true }),
    ).toBeInViewport();
  }
  await overlay
    .getByRole('button', { name: 'Hide participant videos', exact: true })
    .click();
  await expect(
    fullscreen.getByRole('button', { name: 'Show participants', exact: true }),
  ).toBeFocused();
  await fullscreen.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await page
    .getByRole('button', { name: 'View shared screen fullscreen', exact: true })
    .click();
  await expect(
    fullscreen.getByRole('button', { name: 'Show participants', exact: true }),
  ).toBeVisible();
  await expect(
    fullscreen.getByRole('region', { name: 'Fullscreen participants' }),
  ).toBeHidden();
});
