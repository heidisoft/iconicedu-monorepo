import { test, expect } from '@playwright/test';

// The browser owns permission and automatic entry. Simulate its API boundary with
// a real secondary document to exercise adoption, React events and portal placement.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { nativeMeetingPip: window.documentPictureInPicture });
    const handlers = new Map<string, (() => void) | null>();
    Object.defineProperty(navigator, 'mediaSession', {
      value: {
        setActionHandler: (name: string, handler: (() => void) | null) =>
          handlers.set(name, handler),
        setCameraActive: () => Promise.resolve(),
        setMicrophoneActive: () => Promise.resolve(),
      },
    });
    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: {
        requestWindow: async () => {
          const target = window.open(
            'about:blank',
            'meeting-pip',
            'width=540,height=480',
          );
          if (!target) throw new Error('No floating window');
          return target;
        },
      },
    });
    Object.assign(window, {
      triggerMeetingPip: () => handlers.get('enterpictureinpicture')?.(),
    });
  });
  await page.goto('/visual-test/meeting-pip');
});

test('keeps live content and controls working in the floating window and restores it', async ({
  page,
  context,
}) => {
  await page.getByLabel('Whiteboard text').fill('Keep this board');
  await page.getByLabel('Chat message').fill('Draft before opening');
  await page.getByTestId('live-call-canvas').evaluate((node) => {
    (node as HTMLCanvasElement).dataset.identity = 'same-live-node';
  });
  const opened = context.waitForEvent('page');
  await page
    .getByRole('button', { name: 'Open picture-in-picture', exact: true })
    .click();
  const floating = await opened;
  await expect(page.getByTestId('meeting-pip-placeholder')).toBeVisible();
  await expect(floating.getByTestId('live-call-canvas')).toHaveAttribute(
    'data-identity',
    'same-live-node',
  );
  await expect(floating.getByLabel('Chat message')).toHaveValue('Draft before opening');
  await floating.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  await expect(
    floating.getByRole('button', { name: 'Unmute microphone', exact: true }),
  ).toBeVisible();
  await floating.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await floating.getByRole('button', { name: 'Raise hand', exact: true }).click();
  await floating.getByRole('button', { name: 'Turn on captions', exact: true }).click();
  await floating.getByRole('button', { name: 'More controls', exact: true }).click();
  await expect(
    floating.getByRole('menuitem', { name: 'Toggle test captions', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await floating
    .getByRole('menuitem', { name: 'Toggle test captions', exact: true })
    .click();
  await floating.getByRole('button', { name: 'Toggle whiteboard', exact: true }).click();
  await expect(floating.getByLabel('Whiteboard text')).toHaveValue('Keep this board');
  await floating.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(floating.getByText('Draft before opening', { exact: true })).toBeVisible();
  await floating
    .getByRole('button', { name: 'Picture-in-picture settings', exact: true })
    .click();
  await expect(floating.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await floating.getByLabel('Open automatically').selectOption('never');
  await floating.keyboard.press('Escape');
  await floating.getByRole('button', { name: 'Back to call', exact: true }).click();
  await expect(page.getByTestId('meeting-pip-placeholder')).toHaveCount(0);
  await expect(page.getByTestId('live-call-canvas')).toHaveAttribute(
    'data-identity',
    'same-live-node',
  );
  await expect(
    page.getByRole('button', { name: 'Lower hand', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Whiteboard text')).toHaveValue('Keep this board');
});

test('returns content when the floating window is closed by the browser', async ({
  page,
  context,
}) => {
  const opened = context.waitForEvent('page');
  await page
    .getByRole('button', { name: 'Open picture-in-picture', exact: true })
    .click();
  const floating = await opened;
  await floating.close();
  await expect(page.getByTestId('meeting-pip-placeholder')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Picture-in-picture test call' }),
  ).toBeVisible();
});

test('uses automatic browser entry and permits bringing the call back from the original tab', async ({
  page,
  context,
}) => {
  const opened = context.waitForEvent('page');
  await page.evaluate(() =>
    (window as Window & { triggerMeetingPip: () => void }).triggerMeetingPip(),
  );
  const floating = await opened;
  await expect(page.getByRole('button', { name: 'Bring call back here' })).toBeVisible();
  await page.getByRole('button', { name: 'Bring call back here' }).click();
  await expect(page.getByTestId('meeting-pip-placeholder')).toHaveCount(0);
  await expect.poll(() => floating.isClosed()).toBe(true);
});

test('closes the floating window when leaving the call', async ({ page, context }) => {
  const opened = context.waitForEvent('page');
  await page
    .getByRole('button', { name: 'Open picture-in-picture', exact: true })
    .click();
  const floating = await opened;
  await floating.getByRole('button', { name: 'Leave call', exact: true }).click();
  await expect(page.getByText('Call ended', { exact: false })).toBeVisible();
  await expect.poll(() => floating.isClosed()).toBe(true);
});

test('opens and restores through the native browser API when available', async ({
  page,
}) => {
  const supported = await page.evaluate(
    () => !!(window as Window & { nativeMeetingPip?: unknown }).nativeMeetingPip,
  );
  test.skip(!supported, 'The browser does not expose Document Picture-in-Picture.');
  await page.evaluate(() => {
    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: (window as Window & { nativeMeetingPip?: unknown }).nativeMeetingPip,
    });
  });
  await page
    .getByRole('button', { name: 'Open picture-in-picture', exact: true })
    .click();
  await expect(page.getByTestId('meeting-pip-placeholder')).toBeVisible();
  const contentMoved = await page.evaluate(() => {
    const api = window.documentPictureInPicture;
    return !!api?.window?.document.querySelector('[data-testid="live-call-canvas"]');
  });
  expect(contentMoved).toBe(true);
  await page.evaluate(() => {
    const body = window.documentPictureInPicture?.window?.document.body;
    Array.from(body?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent === 'Mute microphone')
      ?.click();
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.documentPictureInPicture?.window?.document.body.textContent?.includes(
          'Unmute microphone',
        ),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Bring call back here' }).click();
  await expect(page.getByTestId('live-call-canvas')).toBeVisible();
});
