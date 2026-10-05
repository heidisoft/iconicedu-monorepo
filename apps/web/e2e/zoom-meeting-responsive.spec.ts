import { expect, test } from '@playwright/test';

const fixturePath = '/visual-test/zoom-meeting';

test.describe('Zoom meeting responsive parity', () => {
  test.describe.configure({ mode: 'serial' });

  test('keeps the desktop header and three toolbar zones aligned', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(fixturePath);

    const header = page.locator('.zoom-meeting-header');
    const timer = page.getByText('11:53', { exact: true });
    const microphone = page.getByRole('button', { name: 'Mute microphone' });
    const participants = page.getByRole('button', { name: 'Participants' });
    const messages = page.getByRole('button', { name: 'Messages' });

    await expect(header).toBeVisible();
    await expect(page.getByRole('heading')).toHaveText(
      'Airbnb: Product Management Structure',
    );
    await expect(page.getByRole('status', { name: 'Recording in progress' })).toHaveText(
      'Recording',
    );

    const [timerBox, microphoneBox, participantsBox, messagesBox] = await Promise.all([
      timer.boundingBox(),
      microphone.boundingBox(),
      participants.boundingBox(),
      messages.boundingBox(),
    ]);
    expect(timerBox).not.toBeNull();
    expect(microphoneBox).not.toBeNull();
    expect(participantsBox).not.toBeNull();
    expect(messagesBox).not.toBeNull();
    expect(timerBox!.x).toBeLessThan(microphoneBox!.x);
    expect(microphoneBox!.x + microphoneBox!.width).toBeLessThan(participantsBox!.x);
    expect(participantsBox!.x + participantsBox!.width).toBeLessThanOrEqual(
      messagesBox!.x,
    );
    expect(messagesBox!.x + messagesBox!.width).toBeLessThanOrEqual(1440);

    const tileBox = await page.locator('.zoom-video-tile').first().boundingBox();
    expect(tileBox).not.toBeNull();
    expect(tileBox!.width / tileBox!.height).toBeCloseTo(16 / 9, 1);
  });

  test('reflows gallery tiles when the People panel opens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(fixturePath);
    await page.getByRole('button', { name: 'Participants' }).click();

    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();

    const panelBox = await panel.boundingBox();
    const tiles = page.locator('.zoom-video-tile');
    await expect(tiles).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      const tileBox = await tiles.nth(index).boundingBox();
      expect(tileBox).not.toBeNull();
      expect(tileBox!.x + tileBox!.width).toBeLessThanOrEqual(panelBox!.x);
    }
  });

  test('keeps tablet controls inside the viewport without overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(fixturePath);

    const toolbar = page.locator('.zoom-toolbar');
    const toolbarBox = await toolbar.boundingBox();
    const peopleBox = await page
      .getByRole('button', { name: 'Participants' })
      .boundingBox();
    const messagesBox = await page
      .getByRole('button', { name: 'Messages' })
      .boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(peopleBox).not.toBeNull();
    expect(messagesBox).not.toBeNull();
    expect(peopleBox!.x + peopleBox!.width).toBeLessThanOrEqual(messagesBox!.x);
    expect(messagesBox!.x + messagesBox!.width).toBeLessThanOrEqual(1024);
  });

  test('keeps the tablet People card between the header and toolbar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto(fixturePath);

    const recording = page.getByRole('status', { name: 'Recording in progress' });
    const peopleButton = page.getByRole('button', { name: 'Participants' });
    await peopleButton.click();

    const panel = page.getByRole('dialog');
    const toolbar = page.locator('.zoom-toolbar');
    const [recordingBox, panelBox, toolbarBox] = await Promise.all([
      recording.boundingBox(),
      panel.boundingBox(),
      toolbar.boundingBox(),
    ]);

    expect(recordingBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(panelBox!.width).toBeLessThan(900 / 2);
    expect(panelBox!.y).toBeGreaterThan(recordingBox!.y + recordingBox!.height);
    expect(panelBox!.y + panelBox!.height).toBeLessThan(toolbarBox!.y);

    for (const tile of await page.locator('.zoom-video-tile').all()) {
      const tileBox = await tile.boundingBox();
      expect(tileBox).not.toBeNull();
      expect(tileBox!.x + tileBox!.width).toBeLessThanOrEqual(panelBox!.x);
    }
  });

  test('keeps essential mobile controls stable and opens More as a sheet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await expect(page.getByRole('button', { name: 'Participants' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Messages' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Mute microphone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop camera' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share screen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open reactions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start whiteboard' })).toBeVisible();

    const toolbar = page.getByRole('toolbar', { name: 'Class controls' });
    await expect(toolbar).toBeVisible();

    await page.getByRole('button', { name: 'More controls' }).click();
    await expect(page.getByRole('heading', { name: 'More controls' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Participants (4)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Messages (2 unread)' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Audio and video settings' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Close more controls' }).click();
    await expect(toolbar).toBeVisible();
    const headerBox = await page.locator('.zoom-meeting-header').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.x).toBeGreaterThanOrEqual(0);
    expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(390);

    const tileBox = await page.locator('.zoom-video-tile').first().boundingBox();
    expect(tileBox).not.toBeNull();
    expect(tileBox!.width / tileBox!.height).toBeCloseTo(16 / 9, 1);
  });

  test('keeps neutral, active, and destructive controls distinct in dark mode', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(fixturePath);

    const neutral = page.getByRole('button', { name: 'Mute microphone' });
    const active = page.locator('.zoom-toolbar-more');
    const destructive = page.getByRole('button', { name: 'Leave class' });

    const neutralColor = await neutral.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const destructiveColor = await destructive.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await active.click();
    const activeColor = await active.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );

    expect(new Set([neutralColor, activeColor, destructiveColor]).size).toBe(3);
  });
});
