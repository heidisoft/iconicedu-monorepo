import { expect, test } from '@playwright/test';
test('draws, edits text, selects objects and stays aligned after resizing', async ({
  page,
}) => {
  await page.goto('/visual-test/screen-annotations');
  const toolbar = page.getByRole('toolbar', { name: 'Screen annotations' });
  await expect(toolbar).toBeVisible();
  const surface = page.locator('[data-shared-content-bounds]');
  const before = await surface.boundingBox();
  expect(before).not.toBeNull();
  await toolbar.getByRole('button', { name: 'Pen', exact: true }).click();
  await page.mouse.move(
    before!.x + before!.width * 0.2,
    before!.y + before!.height * 0.2,
  );
  await page.mouse.down();
  await page.mouse.move(
    before!.x + before!.width * 0.5,
    before!.y + before!.height * 0.4,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(page.getByLabel('Annotation count')).toHaveText('1 mark');
  await toolbar.getByRole('button', { name: 'Text', exact: true }).click();
  await page.mouse.click(
    before!.x + before!.width * 0.6,
    before!.y + before!.height * 0.3,
  );
  await page
    .getByRole('textbox', { name: 'Annotation text' })
    .fill('Work through the equation');
  await page.getByRole('textbox', { name: 'Annotation text' }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'Annotation text' })).toHaveCount(0);
  await expect(page.getByLabel('Annotation count')).toHaveText('2 marks');
  await toolbar
    .getByRole('combobox', { name: 'Shapes and advanced tools' })
    .selectOption('select');
  await page.mouse.click(
    before!.x + before!.width * 0.3,
    before!.y + before!.height * (0.2 + (0.1 * 2) / 3),
  );
  await page.getByRole('button', { name: 'Resize viewer' }).click();
  const after = await surface.boundingBox();
  expect(after!.width).toBeLessThan(before!.width);
  expect(after!.width / after!.height).toBeCloseTo(16 / 9, 3);
  await page.screenshot({ path: '/tmp/iconicedu-screen-annotations.png' });
  await toolbar.getByRole('button', { name: 'Pointer', exact: true }).click();
  await expect(
    toolbar.getByRole('button', { name: 'Pointer', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
test('supports shape variants, formatting and nonpersistent vanishing marks', async ({
  page,
}) => {
  await page.goto('/visual-test/screen-annotations');
  await expect(page.getByRole('toolbar')).toBeVisible();
  const surface = await page.locator('[data-shared-content-bounds]').boundingBox();
  const tools = page.getByRole('combobox', { name: 'Shapes and advanced tools' });
  for (const tool of [
    'doubleArrow',
    'rectangleHighlight',
    'ellipseFilled',
    'diamond',
    'vanishingPen',
  ]) {
    await tools.selectOption(tool);
    await page.mouse.move(
      surface!.x + surface!.width * 0.1,
      surface!.y + surface!.height * 0.15,
    );
    await page.mouse.down();
    await page.mouse.move(
      surface!.x + surface!.width * 0.3,
      surface!.y + surface!.height * 0.3,
      { steps: 8 },
    );
    await page.mouse.up();
  }
  await page.getByText('More', { exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Allow students to annotate' }),
  ).toBeChecked();
  await expect(page.getByLabel('Annotation count')).toHaveText('4 marks');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByLabel('Annotation count')).toHaveText('0 marks');
});
