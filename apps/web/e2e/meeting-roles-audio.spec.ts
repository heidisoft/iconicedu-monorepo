import { expect, test } from '@playwright/test';
test('host can assign and revoke co-host controls without transferring host', async ({
  page,
}) => {
  await page.goto('/visual-test/meeting-roles');
  await page.getByRole('button', { name: 'Options for Staff' }).click();
  await page.getByRole('menuitem', { name: 'Make co-host', exact: true }).click();
  await expect(page.getByText('Co-host', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Options for Staff' }).click();
  await page.getByRole('menuitem', { name: 'Remove co-host', exact: true }).click();
  await expect(page.getByText('Co-host', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('You are host');
});
test('eligible teacher explicitly claims host after a transfer', async ({ page }) => {
  await page.goto('/visual-test/meeting-roles');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate host transfer' }).click();
  await expect(page.getByRole('status')).toHaveText('Another teacher is host');
  await page.getByRole('button', { name: 'Claim host', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('You are host');
});
test('preview offers speaker self-check with denied microphone permission', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new Error('Permission denied')),
        enumerateDevices: () => Promise.resolve([]),
      },
    }),
  );
  await page.goto('/visual-test/live-session-setup?actor=host');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('meter', { name: 'Microphone activity' })).toHaveAttribute(
    'value',
    '0',
  );
  await page.getByRole('button', { name: 'Test speakers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Playing test sound…' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Test speakers', exact: true }),
  ).toBeEnabled();
});

test('co-host assignment is unavailable when classroom controls are disabled', async ({
  page,
}) => {
  await page.goto('/visual-test/meeting-roles?cohosts=off');
  await page.getByRole('button', { name: 'Options for Staff' }).click();
  await expect(page.getByRole('menuitem', { name: 'Make co-host' })).toHaveCount(0);
});
