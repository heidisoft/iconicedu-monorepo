import { test, expect } from '@playwright/test';
import { createWhiteboardClass, joinClassAs, draw } from './helpers/whiteboard-class';

test.describe('native class whiteboard with real API persistence and collaboration', () => {
  let fixture: ReturnType<typeof createWhiteboardClass>;
  test.beforeEach(() => {
    fixture = createWhiteboardClass();
  });
  test.afterEach(() => fixture?.cleanup());
  test('opens the class, draws, saves and restores after refresh', async ({
    browser,
  }) => {
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-board-id',
      fixture.board,
    );
    await draw(page);
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Join class whiteboard' }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await context.close();
  });
  test('keeps classes isolated', async ({ browser }) => {
    const other = createWhiteboardClass();
    try {
      const a = await joinClassAs(browser, fixture.teacher, 'Class A'),
        b = await joinClassAs(browser, other.teacher, 'Class B');
      await draw(a.page);
      await expect(a.page.getByText('Saved', { exact: true })).toBeVisible();
      await expect(b.page.getByTestId('classroom-whiteboard')).toHaveAttribute(
        'data-element-count',
        '0',
      );
      await draw(b.page);
      await draw(b.page);
      await expect(b.page.getByTestId('classroom-whiteboard')).toHaveAttribute(
        'data-element-count',
        '2',
      );
      await expect(a.page.getByTestId('classroom-whiteboard')).toHaveAttribute(
        'data-element-count',
        '1',
      );
      await a.context.close();
      await b.context.close();
    } finally {
      other.cleanup();
    }
  });
  test('pans one infinite canvas without paging or changing saved geometry', async ({
    browser,
    request,
  }) => {
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await expect(page.getByRole('combobox', { name: 'Current page' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add page', exact: true })).toHaveCount(
      0,
    );
    await draw(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const read = async () =>
      (
        await (
          await request.get('http://127.0.0.1:3001/whiteboards/current', {
            headers: { Authorization: `Bearer ${fixture.teacher}` },
          })
        ).json()
      ).document;
    const before = await read();
    expect(before.layout).toBe('infinite');
    const canvas = page.getByTestId('whiteboard-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas unavailable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(300);
    await draw(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect.poll(async () => (await read()).pages[0].elements.length).toBe(2);
    const after = await read();
    expect(after.pages).toHaveLength(1);
    expect(
      after.pages[0].elements.find(
        (e: { id: string }) => e.id === before.pages[0].elements[0].id,
      ).data,
    ).toEqual(before.pages[0].elements[0].data);
    expect(
      Math.abs(after.pages[0].elements[1].data.y - after.pages[0].elements[0].data.y),
    ).toBeGreaterThan(300);
    await page.getByRole('button', { name: 'Pan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pan', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.reload();
    await page.getByRole('button', { name: 'Join class whiteboard' }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '2',
    );
    await context.close();
  });
  test('preserves duplicate drawings from old pages in one persisted canvas', async ({
    browser,
    request,
  }) => {
    const element = {
      id: 'duplicate',
      version: 1,
      nonce: 1,
      deleted: false,
      data: {
        id: 'duplicate',
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 60,
        angle: 0,
        strokeColor: '#1f2a26',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 2,
        roughness: 0,
        link: null,
      },
    };
    fixture.seedDocument({
      schemaVersion: 1,
      studentEditing: true,
      pages: [
        { id: fixture.page, title: 'First page', elements: [element] },
        { id: 'legacy-second', title: 'Second page', elements: [element] },
      ],
    });
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '2',
    );
    await draw(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const response = await request.get('http://127.0.0.1:3001/whiteboards/current', {
      headers: { Authorization: `Bearer ${fixture.teacher}` },
    });
    const { document } = await response.json();
    expect(document.layout).toBe('infinite');
    expect(document.pages).toHaveLength(1);
    expect(document.pages[0].elements).toHaveLength(3);
    expect(
      new Set(document.pages[0].elements.map((e: { id: string }) => e.id)).size,
    ).toBe(3);
    expect(document.pages[0].elements[1].data.y).toBeGreaterThan(
      document.pages[0].elements[0].data.y + 100,
    );
    await page.reload();
    await page.getByRole('button', { name: 'Join class whiteboard' }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '3',
    );
    await context.close();
  });
  test('inserts, selects and deletes a coordinate plane through the library', async ({
    browser,
  }) => {
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Search educational assets' })
      .fill('coordinate');
    await page.getByRole('button', { name: 'Coordinate plane', exact: true }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '26',
    );
    await page.getByTestId('whiteboard-canvas').press('Delete');
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '0',
    );
    await context.close();
  });
  test('moves and resizes educational assets on the real canvas', async ({
    browser,
    request,
  }) => {
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'Graph paper', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const read = async () => {
      const response = await request.get('http://127.0.0.1:3001/whiteboards/current', {
        headers: { Authorization: `Bearer ${fixture.teacher}` },
      });
      return response.json();
    };
    const initial = await read();
    const oldX = initial.document.pages[0].elements[0].data.x;
    const box = await page.getByTestId('whiteboard-canvas').boundingBox();
    if (!box) throw new Error('Canvas unavailable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 50, {
      steps: 10,
    });
    await page.mouse.up();
    await expect
      .poll(async () => (await read()).document.pages[0].elements[0].data.x)
      .not.toBe(oldX);
    const moved = await read();
    const elements = moved.document.pages[0].elements;
    const maxX = Math.max(
      ...elements.map(
        (e: { data: { x: number; width: number } }) => e.data.x + e.data.width,
      ),
    );
    const maxY = Math.max(
      ...elements.map(
        (e: { data: { y: number; height: number } }) => e.data.y + e.data.height,
      ),
    );
    const oldHeight = elements[0].data.height;
    await page.mouse.move(box.x + maxX + 4, box.y + maxY + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + maxX + 84, box.y + maxY + 64, { steps: 10 });
    await page.mouse.up();
    await expect
      .poll(async () => (await read()).document.pages[0].elements[0].data.height)
      .not.toBe(oldHeight);
    await context.close();
  });
  test('enforces the student lock on the UI and API, then enables drawing', async ({
    browser,
    request,
  }) => {
    const teacher = await joinClassAs(browser, fixture.teacher),
      student = await joinClassAs(browser, fixture.student);
    await teacher.page.getByRole('button', { name: 'Board options' }).click();
    await teacher.page.getByRole('menuitemcheckbox', { name: 'Student editing' }).click();
    await expect(teacher.page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(
      student.page.getByRole('button', { name: 'Pen', exact: true }),
    ).toBeDisabled();
    const response = await request.post(
      'http://127.0.0.1:3001/whiteboards/current/operations',
      {
        headers: { Authorization: `Bearer ${fixture.student}` },
        data: { id: 'forbidden', type: 'elements', pageId: fixture.page, elements: [] },
      },
    );
    expect(response.status()).toBe(403);
    await expect(teacher.page.getByText('Saved', { exact: true })).toBeVisible();
    await teacher.page.getByRole('button', { name: 'Board options' }).click();
    await teacher.page.getByRole('menuitemcheckbox', { name: 'Student editing' }).click();
    await expect(
      student.page.getByRole('button', { name: 'Pen', exact: true }),
    ).toBeEnabled();
    await draw(student.page);
    await expect(teacher.page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await teacher.context.close();
    await student.context.close();
  });
  test('collaborates in both directions using independent browser contexts', async ({
    browser,
  }) => {
    const teacher = await joinClassAs(browser, fixture.teacher),
      student = await joinClassAs(browser, fixture.student);
    await draw(teacher.page);
    await expect(student.page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await draw(student.page);
    await expect(teacher.page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '2',
    );
    await expect(
      teacher.page
        .getByLabel('Whiteboard participants')
        .getByRole('img', { name: 'Test student', exact: true }),
    ).toBeVisible();
    await teacher.context.close();
    await student.context.close();
  });
  test('catches up after disconnect without duplicate elements', async ({ browser }) => {
    const teacher = await joinClassAs(browser, fixture.teacher),
      student = await joinClassAs(browser, fixture.student);
    await student.context.setOffline(true);
    await draw(teacher.page);
    await expect(teacher.page.getByText('Saved', { exact: true })).toBeVisible();
    await student.context.setOffline(false);
    await expect(student.page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await teacher.context.close();
    await student.context.close();
  });
  test('undoes and redoes local drawing', async ({ browser }) => {
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await draw(page);
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '0',
    );
    await page.getByRole('button', { name: 'More whiteboard actions' }).click();
    await page.getByRole('menuitem', { name: /Redo/ }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await context.close();
  });
  test('confirms clearing and preserves work on cancel', async ({ browser }) => {
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await draw(page);
    await page.getByRole('button', { name: 'More whiteboard actions' }).click();
    await page.getByRole('menuitem', { name: 'Clear board', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await page.getByRole('button', { name: 'More whiteboard actions' }).click();
    await page.getByRole('menuitem', { name: 'Clear board', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '0',
    );
    await context.close();
  });
  test('keeps tablet controls and assets usable', async ({ browser }) => {
    const { page, context } = await joinClassAs(
      browser,
      fixture.teacher,
      'Tablet class',
      { width: 820, height: 1180 },
    );
    await draw(page);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'Number line', exact: true }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '24',
    );
    await expect(page.getByRole('button', { name: 'Pan', exact: true })).toBeVisible();
    await context.close();
  });
  test('shares teacher presentation with peers and late joiners without video SDK commands', async ({
    browser,
    request,
  }) => {
    const teacher = await joinClassAs(
      browser,
      fixture.teacher,
      'Teacher class',
      undefined,
      true,
    );
    const student = await joinClassAs(
      browser,
      fixture.student,
      'Student class',
      undefined,
      true,
    );
    await teacher.page.getByRole('button', { name: 'Open class whiteboard' }).click();
    await expect(student.page.getByTestId('classroom-whiteboard')).toBeVisible();
    const late = await joinClassAs(
      browser,
      fixture.student,
      'Late joiner',
      undefined,
      true,
    );
    await expect(late.page.getByTestId('classroom-whiteboard')).toBeVisible();
    const forged = await request.post(
      'http://127.0.0.1:3001/whiteboards/current/operations',
      {
        headers: { Authorization: `Bearer ${fixture.student}` },
        data: { id: 'student-present', type: 'presentation', enabled: false },
      },
    );
    expect(forged.status()).toBe(403);
    await teacher.page.getByRole('button', { name: 'End class whiteboard' }).click();
    await expect(student.page.getByText('Whiteboard is closed')).toBeVisible();
    await expect(late.page.getByText('Whiteboard is closed')).toBeVisible();
    await teacher.context.close();
    await student.context.close();
    await late.context.close();
  });
  test('persists bounded batches above the default JSON parser size', async ({
    request,
  }) => {
    const elements = Array.from({ length: 3 }, (_, i) => ({
      id: `text-${i}`,
      version: 1,
      nonce: 1,
      deleted: false,
      data: {
        id: `text-${i}`,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        type: 'text',
        x: i * 300,
        y: 0,
        width: 300,
        height: 20,
        angle: 0,
        text: 'x'.repeat(50000),
        fontSize: 20,
        fontFamily: 2,
        link: null,
      },
    }));
    const response = await request.post(
      'http://127.0.0.1:3001/whiteboards/current/operations',
      {
        headers: { Authorization: `Bearer ${fixture.teacher}` },
        data: { id: 'large-batch', type: 'elements', pageId: fixture.page, elements },
      },
    );
    expect(response.status()).toBe(201);
    expect((await response.json()).document.pages[0].elements).toHaveLength(3);
  });
  test('rejects missing and forged capabilities', async ({ request }) => {
    for (const token of ['', 'x'.repeat(43)]) {
      const response = await request.get('http://127.0.0.1:3001/whiteboards/current', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(403);
    }
  });
});

test('uses themed paper and soft controls without changing saved drawings', async ({
  browser,
}) => {
  const fixture = createWhiteboardClass();
  const { page, context } = await joinClassAs(browser, fixture.teacher);
  try {
    await draw(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const canvas = page.getByTestId('whiteboard-canvas');
    const light = await canvas.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      pattern: getComputedStyle(node).backgroundImage,
    }));
    expect(light.pattern).toContain('radial-gradient');
    await expect(page.getByRole('button', { name: 'Pen', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.screenshot({ path: '/tmp/iconicedu-whiteboard-light.png' });
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    await page.getByRole('button', { name: 'Join class whiteboard' }).click();
    await expect(page.locator('.excalidraw.theme--dark')).toBeVisible();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await page.getByRole('button', { name: 'View controls' }).click();
    await page.getByRole('menuitem', { name: 'Fit content', exact: true }).click();
    await expect
      .poll(async () =>
        canvas.locator('canvas.static').evaluate((node) => {
          const canvas = node as HTMLCanvasElement;
          const pixels = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) return true;
          return false;
        }),
      )
      .toBe(true);
    const dark = await canvas.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(dark).not.toEqual(light.background);
    await page.screenshot({ path: '/tmp/iconicedu-whiteboard-dark.png' });
  } finally {
    await context.close();
    fixture.cleanup();
  }
});

test('reveals grouped whiteboard controls on demand on mobile and in fullscreen', async ({
  browser,
}) => {
  const fixture = createWhiteboardClass();
  let context: Awaited<ReturnType<typeof joinClassAs>>['context'] | undefined;
  try {
    const joined = await joinClassAs(browser, fixture.teacher, 'Geometry class', {
      width: 390,
      height: 844,
    });
    context = joined.context;
    const page = joined.page;
    const canvasBounds = await page.getByTestId('whiteboard-canvas').boundingBox();
    const toolbarBounds = await page
      .getByTestId('whiteboard-overlay-toolbar')
      .boundingBox();
    expect(toolbarBounds!.y).toBeGreaterThan(canvasBounds!.y);
    expect(toolbarBounds!.y + toolbarBounds!.height).toBeLessThan(
      canvasBounds!.y + canvasBounds!.height,
    );
    expect(toolbarBounds!.x).toBeGreaterThan(canvasBounds!.x);
    expect(toolbarBounds!.x + toolbarBounds!.width).toBeLessThanOrEqual(
      canvasBounds!.x + canvasBounds!.width,
    );
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Export board' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Shapes', exact: true }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Rectangle' })).toBeVisible();
    await page.screenshot({ path: '/tmp/iconicedu-whiteboard-toolbar-mobile.png' });
    await page.getByRole('menuitemradio', { name: 'Rectangle' }).click();
    await expect(
      page.getByRole('button', { name: 'Shapes', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Shapes', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'View controls' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Fit content' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'View controls' })).toBeFocused();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page
      .getByTestId('classroom-whiteboard')
      .evaluate((node) => node.requestFullscreen());
    await page.getByRole('button', { name: 'Board options' }).click();
    await expect(
      page
        .getByTestId('classroom-whiteboard')
        .getByRole('menuitem', { name: 'Export board' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Shapes', exact: true }).click();
    await expect(
      page
        .getByTestId('classroom-whiteboard')
        .getByRole('menuitemradio', { name: 'Ellipse' }),
    ).toBeVisible();
    await page.getByRole('menuitemradio', { name: 'Ellipse' }).click();
    const selectBounds = await page
      .getByRole('button', { name: 'Select', exact: true })
      .boundingBox();
    const participantBounds = await page
      .getByLabel('Whiteboard participants')
      .boundingBox();
    expect(selectBounds!.x).toBeLessThan(participantBounds!.x);
    await page.screenshot({ path: '/tmp/iconicedu-whiteboard-toolbar-desktop.png' });
    await page.evaluate(() => document.exitFullscreen());
  } finally {
    await context?.close();
    fixture.cleanup();
  }
});

test('shows contextual styles, preserves choices and syncs styled drawings', async ({
  browser,
  request,
}) => {
  const fixture = createWhiteboardClass();
  const { page, context } = await joinClassAs(browser, fixture.teacher);
  try {
    await page.getByRole('button', { name: 'Pen', exact: true }).click();
    const panel = page.locator('.selected-shape-actions');
    await expect(panel.getByText('Stroke', { exact: true })).toBeVisible();
    await expect(panel.getByText('Stroke width', { exact: true })).toBeVisible();
    await panel.getByTitle('#e03131', { exact: true }).click();
    const opacity = panel.getByRole('slider');
    await opacity.focus();
    await opacity.press('Home');
    for (let i = 0; i < 6; i++) await opacity.press('ArrowRight');
    await expect(opacity).toHaveValue('60');
    // Choosing Pen again must retain the styles the user picked.
    await draw(page);
    const read = async () =>
      (
        await (
          await request.get('http://127.0.0.1:3001/whiteboards/current', {
            headers: { Authorization: `Bearer ${fixture.teacher}` },
          })
        ).json()
      ).document.pages[0].elements;
    await expect.poll(async () => (await read())[0]?.data.strokeColor).toBe('#e03131');
    expect((await read())[0].data.opacity).toBe(60);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    const canvasBox = await page.getByTestId('whiteboard-canvas').boundingBox();
    if (!canvasBox) throw new Error('Canvas unavailable');
    await page.mouse.click(
      canvasBox.x + canvasBox.width / 2 + 30,
      canvasBox.y + canvasBox.height / 2 + 25,
    );
    await expect(panel.getByTitle('#1971c2', { exact: true })).toBeVisible();
    await panel.getByTitle('#1971c2', { exact: true }).click();
    await expect.poll(async () => (await read())[0]?.data.strokeColor).toBe('#1971c2');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await read())[0]?.data.strokeColor).toBe('#e03131');
    await page.getByRole('button', { name: 'Shapes', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Rectangle', exact: true }).click();
    await expect(panel.getByText('Background', { exact: true })).toBeVisible();
    await panel.getByTitle('#a5d8ff', { exact: true }).click();
    await expect(panel.getByText('Fill', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pan', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Pen', exact: true }).click();
    const mobilePanel = page.locator('.App-mobile-menu');
    await expect(mobilePanel.getByText('Stroke', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Hide tool options' }).click();
    await expect(mobilePanel).toHaveCount(0);
    await page.getByRole('button', { name: 'Show tool options' }).click();
    await expect(mobilePanel.getByRole('slider')).toHaveValue('60');
    await page.screenshot({ path: '/tmp/iconicedu-whiteboard-tool-options.png' });
  } finally {
    await context.close();
    fixture.cleanup();
  }
});
