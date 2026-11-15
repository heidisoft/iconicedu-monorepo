import { test, expect } from '@playwright/test';
import { createWhiteboardClass, joinClassAs } from './helpers/whiteboard-class';

test('shares native laser trails in both directions without saving drawing elements', async ({
  browser,
  request,
}) => {
  test.setTimeout(60000);
  const fixture = createWhiteboardClass();
  const contexts = [];
  try {
    const host = await joinClassAs(browser, fixture.teacher);
    contexts.push(host.context);
    const participant = await joinClassAs(browser, fixture.student);
    contexts.push(participant.context);
    for (const [sender, receiver] of [
      [host.page, participant.page],
      [participant.page, host.page],
    ]) {
      await sender.getByRole('button', { name: 'Laser pointer', exact: true }).click();
      const box = (await sender.getByTestId('whiteboard-canvas').boundingBox())!;
      const remoteTrail = receiver.locator('.excalidraw .SVGLayer path[d]:not([d=""])');
      await sender.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await sender.mouse.down();
      for (let step = 0; step < 12; step++) {
        await sender.mouse.move(
          box.x + box.width / 2 + step * 8,
          box.y + box.height / 2 + step * 4,
        );
        await sender.waitForTimeout(40);
      }
      await expect(remoteTrail.first()).toBeVisible();
      await sender.mouse.up();
      await expect.poll(async () => remoteTrail.count()).toBe(0);
    }
    const response = await request.get('http://127.0.0.1:3001/whiteboards/current', {
      headers: { Authorization: `Bearer ${fixture.teacher}` },
    });
    const snapshot = await response.json();
    expect(snapshot.revision).toBe(0);
    expect(snapshot.document.pages[0].elements).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    fixture.cleanup();
  }
});

test('isolates laser presence by meeting and enforces guest annotation permissions', async ({
  request,
}) => {
  const fixture = createWhiteboardClass();
  const other = createWhiteboardClass();
  try {
    const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
    const samples = [
      { id: '00000000-0000-4000-8000-000000000001', x: -140, y: 200, button: 'down' },
    ];
    const published = await request.post(
      'http://127.0.0.1:3001/whiteboards/current/laser',
      {
        headers: headers(fixture.student),
        data: samples,
      },
    );
    expect(published.ok()).toBe(true);
    const read = async (token: string) =>
      (
        await request.get('http://127.0.0.1:3001/whiteboards/current/laser', {
          headers: headers(token),
        })
      ).json();
    expect(await read(fixture.teacher)).toEqual([expect.objectContaining({ samples })]);
    expect(await read(fixture.student)).toEqual([]);
    expect(await read(other.teacher)).toEqual([]);
    fixture.seedDocument({
      schemaVersion: 1,
      studentEditing: false,
      pages: [{ id: fixture.page, title: 'Board', elements: [] }],
    });
    expect(await read(fixture.teacher)).toEqual([]);
    const rejected = await request.post(
      'http://127.0.0.1:3001/whiteboards/current/laser',
      { headers: headers(fixture.student), data: samples },
    );
    expect(rejected.status()).toBe(403);
  } finally {
    fixture.cleanup();
    other.cleanup();
  }
});

test('expires a native laser when its sender disconnects without releasing', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const fixture = createWhiteboardClass();
  const contexts = [];
  try {
    const sender = await joinClassAs(browser, fixture.teacher);
    contexts.push(sender.context);
    const receiver = await joinClassAs(browser, fixture.student);
    contexts.push(receiver.context);
    await sender.page.getByRole('button', { name: 'Laser pointer', exact: true }).click();
    const box = (await sender.page.getByTestId('whiteboard-canvas').boundingBox())!;
    await sender.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await sender.page.mouse.down();
    await sender.page.mouse.move(
      box.x + box.width / 2 + 80,
      box.y + box.height / 2 + 40,
      { steps: 8 },
    );
    const trail = receiver.page.locator('.excalidraw .SVGLayer path[d]:not([d=""])');
    await expect(trail.first()).toBeVisible();
    await sender.context.close();
    await expect.poll(async () => trail.count(), { timeout: 8000 }).toBe(0);
  } finally {
    for (const context of contexts) await context.close();
    fixture.cleanup();
  }
});
