import { expect, test } from '@playwright/test';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';

test('saves modular options, automatically records and locks stop', async ({ page }) => {
  let saved: unknown;
  await page.route('**/classroom-meeting-settings**', async (route) => {
    if (route.request().method() === 'PUT') {
      saved = route.request().postDataJSON().settings;
      await route.fulfill({ json: { enabled: true, settings: saved } });
    } else
      await route.fulfill({
        json: { enabled: true, settings: DEFAULT_LIVE_SESSION_SETTINGS },
      });
  });
  await page.goto('/visual-test/meeting-settings');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  for (const name of [
    'Start Recording',
    'Disable Stop Recording',
    'Whiteboard',
    'Shared Invite',
    'Show Participants',
    'Enable Messages',
  ])
    await page.getByRole('checkbox', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Save meeting options' }).click();
  await expect(page.getByRole('button', { name: 'Recording locked' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Start whiteboard', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share meeting' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Participants' })).toHaveCount(0);
  await expect(
    page.getByText('Sending messages is disabled for this meeting.'),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Send message' })).toHaveCount(0);
  expect(saved).toMatchObject({
    recording: { enabled: true, autoStart: true, allowStop: false },
    whiteboard: { enabled: false },
    invite: { enabled: false },
    participants: { visible: false },
    messages: { visible: true, enabled: false },
  });
});

test('flag-off keeps new creation options hidden', async ({ page }) => {
  await page.route('**/classroom-meeting-settings**', (route) =>
    route.fulfill({ json: { enabled: false, settings: DEFAULT_LIVE_SESSION_SETTINGS } }),
  );
  await page.goto('/visual-test/meeting-settings');
  await expect(page.getByText('Meeting options are disabled')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save meeting options' })).toHaveCount(0);
});

test('failed saves retain options for retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/classroom-meeting-settings**', async (route) => {
    if (route.request().method() !== 'PUT')
      return route.fulfill({
        json: { enabled: true, settings: DEFAULT_LIVE_SESSION_SETTINGS },
      });
    attempts++;
    if (attempts === 1)
      return route.fulfill({ status: 500, json: { message: 'Synthetic failure' } });
    return route.fulfill({
      json: { enabled: true, settings: route.request().postDataJSON().settings },
    });
  });
  await page.goto('/visual-test/meeting-settings');
  await page.getByRole('checkbox', { name: 'Shared Invite' }).uncheck();
  await page.getByRole('button', { name: 'Save meeting options' }).click();
  await expect(page.getByText('Options could not be saved. Try again.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Shared Invite' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Save meeting options' }).click();
  await expect(page.getByRole('region', { name: 'Saved meeting preview' })).toBeVisible();
  expect(attempts).toBe(2);
});
