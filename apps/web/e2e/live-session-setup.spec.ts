import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';

const fixture = '/visual-test/live-session-setup';

test.describe('live session setup and leave navigation', () => {
  test.beforeEach(async ({ page }) => {
    // No real Zoom credentials, auth sessions, hardware or database writes.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.reject(new Error('Preview denied for test')),
          enumerateDevices: () =>
            Promise.resolve([
              { kind: 'audioinput', deviceId: 'mic-one', label: 'Built-in mic' },
              { kind: 'audiooutput', deviceId: 'speaker-one', label: 'Built-in speaker' },
              { kind: 'audiooutput', deviceId: 'speaker-two', label: 'Headphones' },
              { kind: 'audioinput', deviceId: 'mic-two', label: 'USB mic' },
              { kind: 'videoinput', deviceId: 'camera-one', label: 'Built-in camera' },
              { kind: 'videoinput', deviceId: 'camera-two', label: 'USB camera' },
            ]),
        },
      });
    });
    await page.route('**/live-sessions/*/guest-join', async (route) => {
      await route.fulfill({
        json: {
          token: 'synthetic-participant-token',
          sessionName: 'fixture-class',
          displayName:
            route.request().postDataJSON().displayNameOverride ??
            route.request().postDataJSON().displayName,
          studentProfileId: route.request().postDataJSON().studentProfileId,
          expiresAt: null,
        },
      });
    });
  });

  test('a parent chooses the enrolled student in preview and reconnects as that student', async ({
    page,
  }) => {
    let requests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/guest-join')) requests += 1;
    });
    await page.goto(`${fixture}?actor=parent&passcode=demo`);
    await expect(page.getByRole('group', { name: 'Who is joining?' })).toBeVisible();
    const join = page.getByRole('button', { name: 'Join session', exact: true });
    await expect(join).toBeDisabled();
    expect(requests).toBe(0);
    await page.getByRole('radio', { name: 'Ben' }).check();
    await expect(join).toBeEnabled();
    await join.click();
    await expect(page.getByRole('heading', { name: 'Meeting as Ben' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Meeting as Ben' })).toBeVisible();
    expect(requests).toBe(1);
  });

  test('preview controls and editable name stay on the video tile', async ({ page }) => {
    await page.goto(`${fixture}?actor=parent&passcode=demo`);
    await page.getByRole('radio', { name: 'Alice' }).check();
    const tile = page.getByRole('group', { name: 'Your video preview' });
    await expect(tile.getByRole('button', { name: 'Turn microphone on' })).toBeVisible();
    await expect(tile.getByRole('button', { name: 'Turn camera on' })).toBeVisible();
    const nameBox = await tile
      .getByRole('button', { name: 'Change display name, currently Alice' })
      .boundingBox();
    const micBox = await tile
      .getByRole('button', { name: 'Turn microphone on' })
      .boundingBox();
    const cameraBox = await tile
      .getByRole('button', { name: 'Turn camera on' })
      .boundingBox();
    const settingsBox = await tile
      .getByRole('button', { name: 'Settings' })
      .boundingBox();
    expect(settingsBox!.width).toBe(32);
    expect(settingsBox!.height).toBe(cameraBox!.height);
    expect(settingsBox!.y).toBeCloseTo(cameraBox!.y, 0);
    expect(settingsBox!.x - (cameraBox!.x + cameraBox!.width)).toBeCloseTo(6, 0);
    expect(nameBox).not.toBeNull();
    expect(micBox).not.toBeNull();
    expect(cameraBox).not.toBeNull();
    expect(micBox!.x - (nameBox!.x + nameBox!.width)).toBeCloseTo(6, 0);
    expect(cameraBox!.x - (micBox!.x + micBox!.width)).toBeCloseTo(6, 0);
    expect(micBox!.y).toBeCloseTo(nameBox!.y, 0);
    expect(cameraBox!.y).toBeCloseTo(nameBox!.y, 0);
    await tile
      .getByRole('button', { name: 'Change display name, currently Alice' })
      .click();
    await tile.getByRole('textbox', { name: 'Display name' }).fill('Alice S.');
    await tile.getByRole('button', { name: 'Save name' }).click();
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Meeting as Alice S.' }),
    ).toBeVisible();
  });

  test('personal call settings are available before joining and survive reconnect', async ({
    page,
  }) => {
    await page.goto(`${fixture}?actor=member&passcode=demo`);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('combobox', { name: 'Speaker' }).click();
    await page.getByRole('option', { name: 'Headphones' }).click();
    await page.getByRole('radio', { name: 'Original sound', exact: true }).check();
    await page.getByRole('tab', { name: 'Video', exact: true }).click();
    await page.getByRole('button', { name: 'Blur background', exact: true }).click();
    await page.getByRole('switch', { name: 'Mirror my video' }).uncheck();
    await page.getByRole('tab', { name: 'Advanced', exact: true }).click();
    await page.getByRole('switch', { name: 'Sending', exact: true }).uncheck();
    await expect(
      page.getByRole('region', { name: 'Picture-in-picture preferences' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    for (let attempt = 0; attempt < 2; attempt++) {
      const preferences = page.getByText('Media preferences:', { exact: false });
      await expect(preferences).toContainText('"backgroundPreset":"blur"');
      await expect(preferences).toContainText('"audioProcessing":"original"');
      await expect(preferences).toContainText('"mirrored":false');
      await expect(preferences).toContainText('"encode":false');
      await expect(preferences).toContainText('"speakerId":"speaker-two"');
      if (attempt === 0) await page.reload();
    }
  });

  test('discovers photo backgrounds from the public directory and retains the selection', async ({
    page,
  }) => {
    const images = readdirSync('public/live-session-backgrounds')
      .filter((file) => /\.(png|jpe?g|webp|avif|svg)$/i.test(file))
      .sort();
    await page.goto(`${fixture}?actor=host`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'Video', exact: true }).click();
    const gallery = page.getByLabel('Photo backgrounds');
    await expect(gallery.getByRole('button')).toHaveCount(images.length);
    expect(await gallery.evaluate((element) => getComputedStyle(element).overflowY)).toBe(
      'visible',
    );
    await expect(gallery.locator('img').first()).toHaveAttribute(
      'src',
      `/live-session-backgrounds/${encodeURIComponent(images[0])}`,
    );
    await gallery.getByRole('button').first().click();
    await expect(gallery.getByRole('button').first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(page.getByText('Media preferences:', { exact: false })).toContainText(
      `image:${images[0]}`,
    );
    await page.reload();
    await expect(page.getByText('Media preferences:', { exact: false })).toContainText(
      `image:${images[0]}`,
    );
  });

  test('selected preview microphone and camera carry into the meeting and refresh recovery', async ({
    page,
  }) => {
    await page.goto(`${fixture}?actor=member&passcode=demo`);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('combobox', { name: 'Microphone' }).click();
    await page.getByRole('option', { name: 'USB mic' }).click();
    await page.getByRole('tab', { name: 'Video', exact: true }).click();
    await page.getByRole('combobox', { name: 'Camera', exact: true }).click();
    await page.getByRole('option', { name: 'USB camera' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(page.getByText('Microphone device: mic-two')).toBeVisible();
    await expect(page.getByText('Camera device: camera-two')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Microphone device: mic-two')).toBeVisible();
    await expect(page.getByText('Camera device: camera-two')).toBeVisible();
  });

  test('a signed-in participant skips the name prompt and joins through device preview', async ({
    page,
  }) => {
    let requests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/guest-join')) requests += 1;
    });
    await page.goto(`${fixture}?actor=member&passcode=demo`);
    await expect(
      page.getByText('Check your camera and microphone before joining.'),
    ).toBeVisible();
    await expect(page.getByLabel('Your name')).toHaveCount(0);
    await expect(
      page.getByText(
        'Camera/microphone access was blocked. You can still join with them off and enable them later.',
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Meeting as Test Student' }),
    ).toBeVisible();
    expect(requests).toBe(1);
    await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Meeting as Test Student' }),
    ).toBeVisible();
    expect(requests).toBe(1);
  });

  test('a signed-in host skips name and passcode entry', async ({ page }) => {
    await page.goto(`${fixture}?actor=host`);
    await expect(
      page.getByText('Check your camera and microphone before joining.'),
    ).toBeVisible();
    await expect(page.getByLabel('Your name')).toHaveCount(0);
    await expect(page.getByLabel('Session passcode')).toHaveCount(0);
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Meeting as Test Teacher' }),
    ).toBeVisible();
  });

  test('anonymous shared-link visitors provide their name and return to the homepage after feedback', async ({
    page,
  }) => {
    await page.goto(`${fixture}?passcode=demo`);
    await page.getByLabel('Your name').fill('Guest Student');
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(
      page.getByText('Check your camera and microphone before joining.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Meeting as Guest Student' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Leave meeting' }).click();
    await expect(
      page.getByRole('heading', { name: 'How was your session?' }),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Good', exact: true }).click();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page).toHaveURL('/');
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('iconicedu:live-session:fixture-guest'),
      ),
    ).toBeNull();
  });

  test('leaving returns to the original app path and clears refresh recovery', async ({
    page,
  }) => {
    const returnPath = '/visual-test/zoom-meeting?participants=2';
    await page.goto(`${fixture}?actor=host&returnTo=${encodeURIComponent(returnPath)}`);
    await expect(
      page.getByText(
        'Camera/microphone access was blocked. You can still join with them off and enable them later.',
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await page.getByRole('button', { name: 'Leave meeting' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page).toHaveURL(returnPath);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('iconicedu:live-session:fixture-host'),
      ),
    ).toBeNull();
  });

  test('an unsafe return destination falls back to the homepage', async ({ page }) => {
    await page.goto(
      `${fixture}?actor=host&returnTo=${encodeURIComponent('https://evil.invalid')}`,
    );
    await expect(
      page.getByText('Check your camera and microphone before joining.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await page.getByRole('button', { name: 'Leave meeting' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page).toHaveURL('/');
  });

  test('a signed-in shared-link visitor can correct an invalid passcode', async ({
    page,
  }) => {
    await page.route('**/live-sessions/*/guest-join', async (route) => {
      if (route.request().postDataJSON().passcode === 'wrong')
        await route.fulfill({ status: 403, json: { message: 'Incorrect passcode' } });
      else
        await route.fulfill({
          json: {
            token: 'synthetic',
            sessionName: 'fixture-class',
            displayName: 'Test Student',
            expiresAt: null,
          },
        });
    });
    await page.goto(`${fixture}?actor=member&passcode=wrong`);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Incorrect passcode' }),
    ).toHaveText('Incorrect passcode');
    await expect(page.getByLabel('Your name')).toHaveCount(0);
    await page.getByLabel('Session passcode').fill('correct');
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(
      page.getByText('Check your camera and microphone before joining.'),
    ).toBeVisible();
  });
  test('anonymous mobile visitors can enter name and passcode without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixture);
    await page.getByLabel('Your name').fill('Mobile Guest');
    await page.getByLabel('Session passcode').fill('demo');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(
      page.getByText(
        'Camera/microphone access was blocked. You can still join with them off and enable them later.',
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Meeting as Mobile Guest' }),
    ).toBeVisible();
  });
  test('Join shows the previous dialog and cancellation stays on the source page', async ({
    page,
  }) => {
    await page.goto(`${fixture}?actor=dialog`);
    await page.getByRole('button', { name: 'Join live session' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Session ready to join' }),
    ).toBeVisible();
    await expect(page).toHaveURL(`${fixture}?actor=dialog`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(`${fixture}?actor=dialog`);
  });

  test('the dialog copies a clean shared link and opens Zoom in a new tab with its source', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.route('**/live/fixture-host?*', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Meeting setup target</h1>' }),
    );
    await page.goto(`${fixture}?actor=dialog`);
    await page.getByRole('button', { name: 'Join live session' }).click();
    await page.getByRole('button', { name: 'Copy link', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect(copied.pathname).toBe('/live/fixture-host');
    expect(copied.searchParams.get('passcode')).toBe('demo');
    expect(copied.searchParams.has('returnTo')).toBe(false);
    const newPage = context.waitForEvent('page');
    await page.getByRole('link', { name: 'Open Zoom' }).click();
    const meeting = await newPage;
    await meeting.waitForLoadState();
    const opened = new URL(meeting.url());
    expect(opened.pathname).toBe('/live/fixture-host');
    expect(opened.searchParams.get('returnTo')).toBe(`${fixture}?actor=dialog`);
    await expect(page).toHaveURL(`${fixture}?actor=dialog`);
    await meeting.close();
  });
});

for (const actor of ['host', 'member', 'guest']) {
  test(`host ending a meeting shows feedback before returning ${actor} to their join source`, async ({
    page,
  }) => {
    await page.route('**/live-sessions/*/guest-join', (route) =>
      route.fulfill({
        json: {
          token: 'synthetic',
          sessionName: 'fixture-class',
          displayName: `Test ${actor}`,
          expiresAt: null,
        },
      }),
    );
    await page.route('**/live-sessions/*/feedback', (route) =>
      route.fulfill({ json: { success: true } }),
    );
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.reject(new Error('Preview denied for test')),
          enumerateDevices: () =>
            Promise.resolve([
              { kind: 'audioinput', deviceId: 'mic-one', label: 'Built-in mic' },
              { kind: 'audiooutput', deviceId: 'speaker-one', label: 'Built-in speaker' },
              { kind: 'audiooutput', deviceId: 'speaker-two', label: 'Headphones' },
              { kind: 'audioinput', deviceId: 'mic-two', label: 'USB mic' },
              { kind: 'videoinput', deviceId: 'camera-one', label: 'Built-in camera' },
              { kind: 'videoinput', deviceId: 'camera-two', label: 'USB camera' },
            ]),
        },
      });
    });
    const destination = `/visual-test/live-session-setup?actor=dialog&from=${actor}`;
    await page.goto(
      `/visual-test/live-session-setup?actor=${actor}&passcode=demo&returnTo=${encodeURIComponent(destination)}`,
    );
    if (actor === 'guest') {
      await page.getByLabel('Your name').fill('Guest Participant');
      await page.getByRole('button', { name: 'Join session', exact: true }).click();
    }
    await expect(
      page.getByText('Check your camera and microphone before joining.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    if (actor === 'host') {
      await page
        .getByRole('button', { name: 'Host ended meeting', exact: true })
        .evaluate((node) => node.closest('main')!.requestFullscreen());
    }
    await page.getByRole('button', { name: 'Host ended meeting', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(false);
    await expect(
      page.getByRole('heading', { name: 'How was your session?' }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe(destination);
    expect(
      await page.evaluate(
        (id) => sessionStorage.getItem(`iconicedu:live-session:${id}`),
        `fixture-${actor}`,
      ),
    ).toBeNull();
    if (actor === 'guest')
      await page.getByRole('button', { name: 'Skip', exact: true }).click();
    else {
      await page.getByRole('radio', { name: 'Great', exact: true }).click();
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
    }
    await expect(page).toHaveURL(destination);
  });
}
