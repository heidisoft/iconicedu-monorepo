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
  await toolbar.getByRole('button', { name: 'Pan', exact: true }).click();
  await expect(toolbar.getByRole('button', { name: 'Pan', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
    ['', 'Laser pointer'],
  ]) {
    if (group) await page.getByRole('button', { name: group, exact: true }).click();
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

test('keeps rapid strokes and the first shape after a tool change', async ({ page }) => {
  await page.goto('/visual-test/screen-annotations');
  await page.getByRole('button', { name: 'Open annotation toolbar' }).click();
  const surface = page.locator('[data-shared-content-bounds]');
  const box = (await surface.boundingBox())!;
  await expect(surface.locator('[data-recording-annotations]')).toHaveCSS(
    'touch-action',
    'none',
  );
  for (let index = 0; index < 6; index++) {
    await page.mouse.move(
      box.x + box.width * 0.2,
      box.y + box.height * (0.2 + index * 0.05),
    );
    await page.mouse.down();
    // An unrelated touch/capture event must not cancel the active mouse stroke.
    await surface
      .locator('canvas')
      .first()
      .evaluate((canvas) => {
        canvas.dispatchEvent(
          new PointerEvent('pointercancel', { bubbles: true, pointerId: 99 }),
        );
        canvas.dispatchEvent(
          new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 99 }),
        );
      });
    await page.mouse.move(
      box.x + box.width * 0.5,
      box.y + box.height * (0.22 + index * 0.05),
    );
    await page.mouse.up();
  }
  await expect(page.getByLabel('Annotation count')).toHaveText('6 marks');
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.keyboard.press('v');
  await page.mouse.up();
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.2);
  await page.mouse.down();
  // Capture keeps the endpoint even when a fast drag leaves the shared content.
  await page.mouse.move(box.x + box.width + 5, box.y + box.height * 0.5);
  await page.mouse.up();
  await expect(page.getByLabel('Annotation count')).toHaveText('7 marks');
});

test('preserves coalesced handwriting samples in a fast move', async ({ page }) => {
  await page.goto('/visual-test/screen-annotations');
  await page.getByRole('button', { name: 'Open annotation toolbar' }).click();
  const surface = page.locator('[data-shared-content-bounds]');
  const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await surface
    .locator('canvas')
    .first()
    .evaluate((canvas, bounds) => {
      const sample = (x: number, y: number) =>
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          buttons: 1,
          clientX: bounds.x + bounds.width * x,
          clientY: bounds.y + bounds.height * y,
        });
      const move = sample(0.5, 0.2);
      Object.defineProperty(move, 'getCoalescedEvents', {
        value: () => [sample(0.3, 0.4), sample(0.4, 0.1), sample(0.5, 0.2)],
      });
      canvas.dispatchEvent(move);
    }, box);
  await page.mouse.up();
  await expect(page.getByLabel('Annotation count')).toHaveText('1 mark');
  const inkHeight = await surface
    .locator('canvas')
    .first()
    .evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height);
      let top = canvas.height,
        bottom = -1;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++)
          if (data[(y * canvas.width + x) * 4 + 3]) {
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      return bottom - top;
    });
  expect(inkHeight).toBeGreaterThan(box.height * 0.25);
});

test('shows live ink when saved annotations are composited into the shared video', async ({
  page,
}) => {
  await page.goto('/visual-test/screen-annotations');
  await page.getByRole('checkbox', { name: 'Simulate composited share' }).check();
  await page.getByRole('button', { name: 'Open annotation toolbar' }).click();
  const surface = page.locator('[data-shared-content-bounds]');
  const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await expect
    .poll(() =>
      surface
        .locator('canvas')
        .nth(1)
        .evaluate((canvas: HTMLCanvasElement) => {
          const pixels = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          return (
            pixels.some((value, index) => index % 4 === 3 && value > 0) &&
            getComputedStyle(canvas.parentElement!.parentElement!).opacity !== '0'
          );
        }),
    )
    .toBe(true);
  await page.mouse.up();
  await expect(page.getByLabel('Annotation count')).toHaveText('1 mark');
});

test('shows presenter tools and keeps a restored floating toolbar inside a resized share', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'annotation-toolbar',
      JSON.stringify({ dock: 'floating', position: { x: 9999, y: 9999 } }),
    ),
  );
  await page.goto('/visual-test/screen-annotations');
  await page.getByRole('checkbox', { name: 'Presenter view' }).check();
  const toolbar = page.getByRole('toolbar', { name: 'Screen annotations' });
  await expect(toolbar).toHaveAttribute('data-expanded', 'true');
  await expect(toolbar.getByRole('button', { name: 'Pan', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const width of [1200, 390, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const bar = (await toolbar.boundingBox())!;
        const share = (await page.locator('[data-shared-content-bounds]').boundingBox())!;
        return (
          bar.x >= share.x &&
          bar.y >= share.y &&
          bar.x + bar.width <= share.x + share.width + 1 &&
          bar.y + bar.height <= share.y + share.height + 1
        );
      })
      .toBe(true);
  }
  await toolbar.getByRole('button', { name: 'Pan', exact: true }).click();
  await page
    .getByTestId('annotation-viewer')
    .evaluate((node) => node.setAttribute('aria-hidden', 'true'));
  await page.keyboard.press('k');
  await page
    .getByTestId('annotation-viewer')
    .evaluate((node) => node.removeAttribute('aria-hidden'));
  await expect(toolbar.getByRole('button', { name: 'Pan', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('k');
  await expect(
    toolbar.getByRole('button', { name: 'Laser pointer', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('h');
  await expect(toolbar.getByRole('button', { name: 'Pan', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
