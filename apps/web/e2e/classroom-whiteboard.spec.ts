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
  test('creates independent pages, duplicates, reorders and deletes them', async ({
    browser,
  }) => {
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await draw(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add page', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Current page' }).locator('option'),
    ).toHaveCount(2);
    await page.getByRole('combobox', { name: 'Current page' }).selectOption({ index: 1 });
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '0',
    );
    await draw(page);
    await draw(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Current page' }).selectOption({ index: 0 });
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await page.getByRole('combobox', { name: 'Current page' }).selectOption({ index: 1 });
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '2',
    );
    await page.getByRole('button', { name: 'Duplicate page', exact: true }).click();
    await expect(page.getByRole('combobox').locator('option')).toHaveCount(3);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Move page earlier' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete page', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('combobox').locator('option')).toHaveCount(2);
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
    await teacher.page.getByRole('checkbox', { name: 'Student editing' }).uncheck();
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
    await teacher.page.getByRole('checkbox', { name: 'Student editing' }).check();
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
    await expect(teacher.page.getByLabel('Whiteboard participants')).toContainText(
      'Test student',
    );
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
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await context.close();
  });
  test('confirms clearing and preserves work on cancel', async ({ browser }) => {
    const { page, context } = await joinClassAs(browser, fixture.teacher);
    await draw(page);
    await page.getByRole('button', { name: 'Clear page', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await page.getByRole('button', { name: 'Clear page', exact: true }).click();
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
    await expect(page.getByRole('combobox', { name: 'Current page' })).toBeVisible();
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
