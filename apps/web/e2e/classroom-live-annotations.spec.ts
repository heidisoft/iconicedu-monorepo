import { expect, test } from '@playwright/test';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('live shared screen receives pen marks and supports undo/redo @live-classroom', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const path = process.env.CLASSROOM_E2E_ANNOTATION_PATH;
  test.skip(
    !path,
    'Set CLASSROOM_E2E_ANNOTATION_PATH; a peer must present a fresh synthetic slide.',
  );
  if (!path?.startsWith('/live/') || /[?#]/.test(path))
    throw new Error('CLASSROOM_E2E_ANNOTATION_PATH must be a plain /live/<code> path.');
  await page.goto(path);
  await expect(page.getByRole('group', { name: 'Your video preview' })).toBeVisible();
  await expect(page.getByText('Session passcode', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Join session', exact: true }).click();
  try {
    await page
      .getByRole('button', { name: 'Open annotation toolbar', exact: true })
      .click({ timeout: 60_000 });
    const count = page.getByRole('status', { name: 'Annotation count' });
    await expect(count).toHaveText('0');
    await page.getByRole('button', { name: 'Pen', exact: true }).click();
    const surface = page.locator('[data-recording-annotations]').first();
    const box = await surface.boundingBox();
    if (!box) throw new Error('Received share drawing surface unavailable.');
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, {
      steps: 12,
    });
    await page.mouse.up();
    await expect(count).toHaveText('1');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(count).toHaveText('0');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(count).toHaveText('1');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(count).toHaveText('0');
  } finally {
    const leave = page.getByRole('button', {
      name: /^(Leave class|Leave or end class|End class)$/,
    });
    if (await leave.isVisible()) {
      await leave.click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Leave', exact: true })
        .click();
    }
  }
});
