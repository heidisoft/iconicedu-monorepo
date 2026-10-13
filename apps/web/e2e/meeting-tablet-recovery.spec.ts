import { expect, test } from '@playwright/test';
import { createMeetingClass } from './helpers/meeting-class';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new Error('Denied for test')),
        enumerateDevices: () => Promise.resolve([]),
      },
    }),
  );
});
test('tablet rotates and uses split view without losing preview identity', async ({
  page,
}) => {
  const data = createMeetingClass();
  try {
    await page.goto(
      `/visual-test/live-session-setup?actor=link&sessionId=${data.session}#handoff=${data.identities[1].handoff}`,
    );
    for (const viewport of [
      { width: 834, height: 1194 },
      { width: 1194, height: 834 },
      { width: 507, height: 834 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('group', { name: 'Your video preview' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Join session', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Change display name, currently Student' }),
    ).toBeVisible();
    await expect(page.getByLabel('Session passcode')).toHaveCount(0);
  } finally {
    data.cleanup();
  }
});
test('rejoin after connection failure preserves personal identity and access expiry', async ({
  page,
}) => {
  const data = createMeetingClass();
  try {
    await page.goto(
      `/visual-test/live-session-setup?actor=link&sessionId=${data.session}#handoff=${data.identities[1].handoff}`,
    );
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meeting as Student' })).toBeVisible();
    const before = await page.evaluate(() =>
      sessionStorage.getItem(
        Object.keys(sessionStorage).find((key) =>
          key.startsWith('iconicedu:meeting-link:'),
        )!,
      ),
    );
    await page.getByRole('button', { name: 'Simulate connection failure' }).click();
    await page.getByRole('button', { name: 'Rejoin class', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meeting as Student' })).toBeVisible();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem(
          Object.keys(sessionStorage).find((key) =>
            key.startsWith('iconicedu:meeting-link:'),
          )!,
        ),
      ),
    ).toBe(before);
    await expect(page.getByLabel('Session passcode')).toHaveCount(0);
  } finally {
    data.cleanup();
  }
});
test('network recovery and foreground return refresh device choices without activating media', async ({
  page,
  context,
}) => {
  const data = createMeetingClass();
  try {
    await page.goto(
      `/visual-test/live-session-setup?actor=link&sessionId=${data.session}#handoff=${data.identities[1].handoff}`,
    );
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meeting as Student' })).toBeVisible();
    const count = Number(await page.getByTestId('device-refreshes').textContent());
    await context.setOffline(true);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect
      .poll(async () => Number(await page.getByTestId('device-refreshes').textContent()))
      .toBeGreaterThan(count);
    await expect(page.getByRole('heading', { name: 'Meeting as Student' })).toBeVisible();
  } finally {
    await context.setOffline(false);
    data.cleanup();
  }
});

test('tablet meeting controls fit portrait, landscape and narrow split view', async ({
  page,
}) => {
  await page.goto('/visual-test/zoom-meeting');
  for (const viewport of [
    { width: 834, height: 1194 },
    { width: 1194, height: 834 },
    { width: 507, height: 834 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole('button', { name: 'Mute microphone', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Stop camera', exact: true }),
    ).toBeVisible();
    const toolbar = await page.locator('.zoom-toolbar').boundingBox();
    expect(toolbar).not.toBeNull();
    expect(toolbar!.x).toBeGreaterThanOrEqual(0);
    expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
