import { expect, test, type Page } from '@playwright/test';
import { readClassroomE2EConfig } from '../../../scripts/classroom-e2e-config.mjs';
import { draw } from './helpers/whiteboard-class';

// Live credentials/media must never be saved in traces, videos or screenshots.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const path = process.env.CLASSROOM_E2E_CONFIG;
const config = path ? readClassroomE2EConfig(path) : undefined;

async function control(page: Page, name: string) {
  let button = page.getByRole('button', { name, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole('button', { name: 'More controls', exact: true }).click();
    const menuItem = page.getByRole('menuitem', { name, exact: true });
    if (await menuItem.isVisible()) {
      await menuItem.click();
      return;
    }
    button = page.getByRole('button', { name, exact: true });
  }
  await button.click();
}

test.describe('live classroom source journeys @live-classroom', () => {
  test.describe.configure({ mode: 'serial', retries: 0, timeout: 180_000 });
  test.skip(!config, 'Requires CLASSROOM_E2E_CONFIG and signed-in test storage state.');
  if (!config) test('live environment configuration is required', () => {});
  for (const journey of config?.journeys ?? []) {
    test(`${journey.source}, ${journey.scheduled ? 'scheduled' : 'unscheduled'}, ${journey.existingSession ? 'running session' : 'no running session'}`, async ({
      page,
      context,
    }) => {
      if (!config) throw new Error('Live classroom configuration is required.');
      await context.grantPermissions(['camera', 'microphone'], {
        origin: config.webOrigin,
      });
      await page.goto(new URL(journey.webPath, config.webOrigin).href);
      const join = page.locator(journey.joinSelector);
      await expect(join).toHaveCount(1);
      await expect(join).toBeEnabled();
      // A source-page Join may open a ready dialog and then a new tab.
      const pages: Page[] = [];
      const created: boolean[] = [];
      page.on('response', async (response) => {
        if (
          /\/channels\/[^/]+\/live-sessions\/join$/.test(
            new URL(response.url()).pathname,
          ) &&
          response.ok()
        ) {
          const body = await response.json();
          if (typeof body.created === 'boolean') created.push(body.created);
        }
      });
      context.on('page', (opened) => pages.push(opened));
      await join.click();
      const ready = page.getByRole('dialog').filter({ hasText: 'Session ready to join' });
      await expect
        .poll(
          async () =>
            pages.length > 0 || /\/live\//.test(page.url()) || (await ready.isVisible()),
          { timeout: 30_000 },
        )
        .toBeTruthy();
      if (await ready.isVisible())
        await ready
          .getByRole('button', { name: /Open Zoom|Open session|Join Zoom/ })
          .click();
      await expect
        .poll(() => pages.length || /\/live\//.test(page.url()), { timeout: 30_000 })
        .toBeTruthy();
      const meeting = pages.at(-1) ?? page;
      if (!journey.existingSession)
        await expect.poll(() => created.includes(true)).toBe(true);
      else expect(created).not.toContain(true);
      await expect(
        meeting.getByRole('group', { name: 'Your video preview' }),
      ).toBeVisible({ timeout: 45_000 });
      await expect(meeting.getByText('Session passcode', { exact: true })).toHaveCount(0);
      await expect(
        meeting.getByRole('button', { name: /Change display name, currently/ }),
      ).toHaveAccessibleName(`Change display name, currently ${journey.displayName}`);
      await meeting.getByRole('button', { name: 'Join session', exact: true }).click();
      try {
        await expect(
          meeting.getByRole('toolbar', { name: 'Class controls' }),
        ).toBeVisible({ timeout: 60_000 });
        const claimHost = meeting.getByRole('button', {
          name: 'Claim host',
          exact: true,
        });
        if (await claimHost.isVisible()) await claimHost.click();
        for (const [off, on] of [
          ['Mute microphone', 'Unmute microphone'],
          ['Stop camera', 'Start camera'],
        ]) {
          if (await meeting.getByRole('button', { name: off, exact: true }).isVisible())
            await control(meeting, off);
          await control(meeting, on);
          await expect(
            meeting.getByRole('button', { name: off, exact: true }),
          ).toBeVisible();
          await control(meeting, off);
          await expect(
            meeting.getByRole('button', { name: on, exact: true }),
          ).toBeVisible();
        }
        await control(meeting, 'Participants');
        await expect(
          meeting.getByText(journey.displayName, { exact: true }).first(),
        ).toBeVisible();
        await control(meeting, 'Participants');
        await control(meeting, 'Raise hand');
        await expect(
          meeting.getByRole('button', { name: 'Lower hand', exact: true }),
        ).toBeVisible();
        await control(meeting, 'Lower hand');
        await control(meeting, 'Start recording');
        await expect(
          meeting.getByRole('status', { name: 'Recording in progress' }),
        ).toBeVisible({ timeout: 30_000 });
        await control(meeting, 'Stop recording');
        await expect(
          meeting.getByRole('status', { name: 'Not recording' }),
        ).toBeVisible();
        await control(meeting, 'Share screen');
        await expect(
          meeting.getByRole('button', { name: 'Stop sharing screen', exact: true }),
        ).toBeVisible({ timeout: 30_000 });
        await control(meeting, 'Stop sharing screen');
        await control(meeting, 'Open whiteboard');
        await expect(meeting.getByTestId('whiteboard-canvas')).toBeVisible();
        const board = meeting.getByTestId('classroom-whiteboard');
        await expect(board).toHaveAttribute('data-element-count', '0');
        await draw(meeting);
        await expect(board).toHaveAttribute('data-element-count', '1');
        await expect(meeting.getByText('Saved', { exact: true })).toBeVisible();
        await meeting.getByRole('button', { name: 'Text', exact: true }).click();
        const canvas = await meeting.getByTestId('whiteboard-canvas').boundingBox();
        if (!canvas) throw new Error('Whiteboard canvas unavailable.');
        await meeting.mouse.click(
          canvas.x + canvas.width * 0.4,
          canvas.y + canvas.height * 0.6,
        );
        await meeting.keyboard.type('Live web whiteboard writing');
        await meeting.keyboard.press('Escape');
        await expect(board).toHaveAttribute('data-element-count', '2');
        await expect(meeting.getByText('Saved', { exact: true })).toBeVisible();
      } finally {
        // Always attempt to release the live SDK session, even after a control fails.
        const leave = meeting.getByRole('button', {
          name: /^(Leave class|Leave or end class|End class)$/,
        });
        if (await leave.isVisible()) {
          await leave.click();
          const end = meeting
            .getByRole('button', { name: /^(End for everyone|End class)$/ })
            .last();
          if (await end.isVisible()) await end.click();
        }
      }
    });
  }
});
