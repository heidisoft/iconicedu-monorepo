import { expect, test } from '@playwright/test';
import { participantColor } from '@iconicedu/utils';
test('draws, edits text, selects objects and stays aligned after resizing', async ({
  page,
}) => {
  await page.goto('/visual-test/screen-annotations');
  const toolbar = page.getByRole('toolbar', { name: 'Screen annotations' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Open annotation toolbar' }).click();
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
  await toolbar.getByRole('button', { name: 'Select', exact: true }).click();
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
  await page.getByRole('button', { name: 'Open annotation toolbar' }).click();
  const surface = await page.locator('[data-shared-content-bounds]').boundingBox();
  for (const [group, tool] of [
    ['Shapes', 'Double arrow'],
    ['Shapes', 'Rectangle highlight'],
    ['Shapes', 'Filled ellipse'],
    ['Shapes', 'Diamond'],
    ['Attention', 'Vanishing pen'],
  ]) {
    await page.getByRole('button', { name: group, exact: true }).click();
    await page.getByRole('button', { name: tool, exact: true }).click();
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
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Allow participants to annotate' }),
  ).toBeChecked();
  await expect(page.getByLabel('Annotation count')).toHaveText('4 marks');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByLabel('Annotation count')).toHaveText('0 marks');
});

test('opens from a pen button and keeps grouped tools usable in a narrow viewer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/visual-test/screen-annotations');
  const toolbar = page.getByRole('toolbar', { name: 'Screen annotations' });
  await expect(toolbar.getByRole('button')).toHaveCount(1);
  await toolbar.getByRole('button', { name: 'Open annotation toolbar' }).click();
  await expect(toolbar.getByRole('button', { name: 'Pen', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const pen = toolbar.getByRole('button', { name: 'Pen', exact: true });
  await expect(pen).toHaveCSS('width', '32px');
  await expect(pen.locator('svg')).toHaveAttribute('width', '16');
  await expect(toolbar).toHaveCSS('overflow-x', 'auto');
  await expect(toolbar).toHaveCSS('flex-wrap', 'nowrap');
  expect(
    await toolbar.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  await toolbar.getByRole('button', { name: 'Shapes', exact: true }).click();
  const shapes = page.getByRole('group', { name: 'Shapes', exact: true });
  await expect(shapes).toBeVisible();
  const bounds = await shapes.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await shapes.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await expect(shapes).toHaveCount(0);
  await expect(
    toolbar.getByRole('button', { name: 'Shapes', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await toolbar.getByRole('button', { name: 'Format', exact: true }).click();
  const format = page.getByRole('group', { name: 'Format', exact: true });
  await expect(format).toBeVisible();
  await expect(format.getByLabel('Stroke width')).toHaveCSS('height', '32px');
  await expect(format.getByRole('group', { name: 'Stroke', exact: true })).toBeVisible();
  await expect(format.getByLabel('Annotation color')).toHaveValue(
    participantColor('fixture-tutor'),
  );
  await format.getByRole('button', { name: 'Color #ef4444' }).click();
  await expect(format.getByRole('button', { name: 'Color #ef4444' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const formatBounds = await format.boundingBox();
  expect(formatBounds!.width).toBeLessThanOrEqual(240);
  expect(formatBounds!.x + formatBounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/iconicedu-annotation-format-compact.png' });
  await toolbar.getByRole('button', { name: 'Close annotation toolbar' }).click();
  await expect(toolbar.getByRole('button')).toHaveCount(1);
  await toolbar.getByRole('button', { name: 'Open annotation toolbar' }).click();
  await toolbar.getByRole('button', { name: 'Pen', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(
    toolbar.getByRole('button', { name: 'Open annotation toolbar' }),
  ).toBeFocused();
});

test('draws a crisp constrained rectangle and hides the visual mark counter', async ({
  page,
}) => {
  await page.goto('/visual-test/screen-annotations');
  const toolbar = page.getByRole('toolbar', { name: 'Screen annotations' });
  await expect(toolbar).toBeVisible();
  expect(
    await toolbar.evaluate(
      (node) =>
        parseFloat(getComputedStyle(node).borderRadius) >=
        node.getBoundingClientRect().height / 2,
    ),
  ).toBe(true);
  await toolbar.getByRole('button', { name: 'Open annotation toolbar' }).click();
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  const surface = page.locator('[data-shared-content-bounds]');
  const box = (await surface.boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.getByLabel('Annotation count')).toHaveText('1 mark');
  const bounds = await surface
    .locator('canvas')
    .first()
    .evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width,
        top = canvas.height,
        right = -1,
        bottom = -1;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] > 0) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      return { width: right - left, height: bottom - top };
    });
  expect(bounds.width).toBeGreaterThan(100);
  expect(Math.abs(bounds.width - bounds.height)).toBeLessThanOrEqual(2);
  expect(
    await page
      .getByLabel('Annotation count')
      .evaluate((node) => node.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(1);
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.3);
  await expect(page.getByLabel('Annotation count')).toHaveText('1 mark');
});

test('opens the toolbar without animation when reduced motion is requested', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/visual-test/screen-annotations');
  const toolbar = page.getByRole('toolbar', { name: 'Screen annotations' });
  await toolbar.getByRole('button', { name: 'Open annotation toolbar' }).click();
  expect(await toolbar.evaluate((node) => node.getAnimations().length)).toBe(0);
});
