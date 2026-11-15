import { expect, test } from '@playwright/test';
import { createMeetingClass } from './helpers/meeting-class';
const api = 'http://127.0.0.1:3001';
const entry = (session: string, fragment: string) =>
  `/visual-test/live-session-setup?actor=link&sessionId=${session}#${fragment}`;
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new Error('Denied for test')),
        enumerateDevices: () => Promise.resolve([]),
      },
    }),
  );
});
test('invitation preserves access through preview refresh, meeting refresh and leave', async ({
  page,
}) => {
  const data = createMeetingClass();
  try {
    await page.goto(entry(data.session, `invite=${data.invite}`));
    await expect(page.getByRole('group', { name: 'Your video preview' })).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await page.reload();
    await expect(page.getByRole('group', { name: 'Your video preview' })).toBeVisible();
    await expect(page.getByLabel('Session passcode')).toHaveCount(0);
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meeting as Guest' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Meeting as Guest' })).toBeVisible();
    await page.getByRole('button', { name: 'Leave meeting' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page).toHaveURL('/');
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).filter((k) =>
          k.startsWith('iconicedu:meeting-link:'),
        ),
      ),
    ).toEqual([]);
  } finally {
    data.cleanup();
  }
});
for (const role of ['Student', 'Teacher', 'Staff'])
  test(`mobile ${role} retains identity on refresh without name or password`, async ({
    page,
  }) => {
    const data = createMeetingClass();
    try {
      const identity = data.identities.find((i) => i.name === role)!;
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(entry(data.session, `handoff=${identity.handoff}`));
      await expect(page.getByRole('group', { name: 'Your video preview' })).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole('button', { name: `Change display name, currently ${role}` }),
      ).toBeVisible();
      await expect(page.getByLabel('Session passcode')).toHaveCount(0);
      await page.getByRole('button', { name: 'Join session', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: `Meeting as ${role}` }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole('heading', { name: `Meeting as ${role}` }),
      ).toBeVisible();
    } finally {
      data.cleanup();
    }
  });
test('lost handoff response retries with the same browser secret', async ({ page }) => {
  const data = createMeetingClass();
  let dropped = false;
  let key: string | undefined;
  try {
    await page.route('**/link-info', async (route) => {
      const body = route.request().postDataJSON();
      if (body.handoff) {
        if (key) expect(body.redemptionKey).toBe(key);
        key = body.redemptionKey;
      }
      if (!dropped) {
        dropped = true;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort('failed');
      } else await route.continue();
    });
    await page.goto(entry(data.session, `handoff=${data.identities[1].handoff}`));
    await expect(page.getByText('Unable to join', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Change display name, currently Student' }),
    ).toBeVisible();
  } finally {
    data.cleanup();
  }
});
for (const invalid of ['expired', 'rotated'])
  test(`${invalid} invitation cannot obtain access`, async ({ page }) => {
    const data = createMeetingClass();
    try {
      if (invalid === 'expired') data.expireInvite();
      else data.rotatePasscode();
      await page.goto(entry(data.session, `invite=${data.invite}`));
      await expect(page.getByText('Unable to join', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Join session', exact: true }),
      ).toHaveCount(0);
    } finally {
      data.cleanup();
    }
  });
for (const mode of ['trusted', 'restricted'] as const)
  test(`${mode} enforces approval before issuing credentials`, async ({
    page,
    request,
  }) => {
    const data = createMeetingClass(mode);
    try {
      const teacher = await request.post(
        `${api}/live-sessions/${data.session}/link-info`,
        {
          data: {
            token: data.identities[0].handoff,
            handoff: true,
            redemptionKey: 't'.repeat(32),
          },
        },
      );
      expect(teacher.ok()).toBe(true);
      const { linkToken } = await teacher.json();
      await page.goto(entry(data.session, `invite=${data.invite}`));
      await expect(page.getByText('Waiting for approval', { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByText('Waiting for approval', { exact: true })).toBeVisible();
      const waiting = await request.post(
        `${api}/live-sessions/${data.session}/waiting-room`,
        { data: { linkToken } },
      );
      expect(waiting.ok()).toBe(true);
      const [guest] = await waiting.json();
      const denied = await request.post(
        `${api}/live-sessions/${data.session}/waiting-room`,
        { data: { linkToken: data.invite, id: guest.id, approved: true } },
      );
      expect(denied.status()).toBe(403);
      const approve = await request.post(
        `${api}/live-sessions/${data.session}/waiting-room`,
        { data: { linkToken, id: guest.id, approved: true } },
      );
      expect(approve.ok()).toBe(true);
      await expect(page.getByText('Waiting for approval', { exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole('button', { name: 'Join session', exact: true }),
      ).toBeEnabled();
      await page.getByRole('button', { name: 'Join session', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Meeting as Guest' })).toBeVisible();
    } finally {
      data.cleanup();
    }
  });

for (const mode of ['trusted', 'restricted'] as const)
  test(`${mode} applies enrolled student admission independently of passwords`, async ({
    page,
    request,
  }) => {
    const data = createMeetingClass(mode);
    try {
      await page.goto(entry(data.session, `handoff=${data.identities[1].handoff}`));
      await expect(page.getByLabel('Session passcode')).toHaveCount(0);
      if (mode === 'trusted') {
        await expect(
          page.getByRole('group', { name: 'Your video preview' }),
        ).toBeVisible();
        await expect(page.getByText('Waiting for approval', { exact: true })).toHaveCount(
          0,
        );
      } else {
        await expect(
          page.getByText('Waiting for approval', { exact: true }),
        ).toBeVisible();
        data.end();
        await expect(
          page.getByRole('alert').filter({ hasText: 'Session has ended' }),
        ).toBeVisible();
      }
      const unauthenticated = await request.post(
        `${api}/live-sessions/${data.session}/waiting-room`,
        { data: {} },
      );
      expect(unauthenticated.status()).toBe(mode === 'trusted' ? 403 : 404);
    } finally {
      data.cleanup();
    }
  });
test('denied guest cannot bypass approval by directly calling join', async ({
  page,
  request,
}) => {
  const data = createMeetingClass('trusted');
  try {
    const hostResponse = await request.post(
      `${api}/live-sessions/${data.session}/link-info`,
      {
        data: {
          token: data.identities[0].handoff,
          handoff: true,
          redemptionKey: 'h'.repeat(32),
        },
      },
    );
    const { linkToken } = await hostResponse.json();
    await page.goto(entry(data.session, `invite=${data.invite}`));
    await expect(page.getByText('Waiting for approval', { exact: true })).toBeVisible();
    const waiting = await request.post(
      `${api}/live-sessions/${data.session}/waiting-room`,
      { data: { linkToken } },
    );
    const [guest] = await waiting.json();
    await request.post(`${api}/live-sessions/${data.session}/waiting-room`, {
      data: { linkToken, id: guest.id, approved: false },
    });
    await expect(
      page.getByRole('alert').filter({ hasText: 'declined or expired' }),
    ).toBeVisible();
    const result = await request.post(`${api}/live-sessions/${data.session}/guest-join`, {
      data: { displayName: 'Guest', passcode: 'DemoPass12' },
    });
    expect(result.status()).toBe(400);
    expect(await result.json()).not.toHaveProperty('token');
  } finally {
    data.cleanup();
  }
});
test('a cancelled request leaves the waiting room', async ({ page, request }) => {
  const data = createMeetingClass('trusted');
  try {
    const host = await request.post(`${api}/live-sessions/${data.session}/link-info`, {
      data: {
        token: data.identities[0].handoff,
        handoff: true,
        redemptionKey: 'h'.repeat(32),
      },
    });
    const { linkToken } = await host.json();
    await page.goto(entry(data.session, `invite=${data.invite}`));
    await expect(page.getByText('Waiting for approval', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel request' }).click();
    await expect(page).toHaveURL('/');
    await expect
      .poll(async () => {
        const response = await request.post(
          `${api}/live-sessions/${data.session}/waiting-room`,
          { data: { linkToken } },
        );
        return (await response.json()).length;
      })
      .toBe(0);
  } finally {
    data.cleanup();
  }
});
test('another browser cannot replay a redeemed personal handoff', async ({ request }) => {
  const data = createMeetingClass();
  try {
    const path = `${api}/live-sessions/${data.session}/link-info`;
    const first = await request.post(path, {
      data: {
        token: data.identities[1].handoff,
        handoff: true,
        redemptionKey: 'a'.repeat(32),
      },
    });
    expect(first.ok()).toBe(true);
    const replay = await request.post(path, {
      data: {
        token: data.identities[1].handoff,
        handoff: true,
        redemptionKey: 'b'.repeat(32),
      },
    });
    expect(replay.status()).toBe(403);
  } finally {
    data.cleanup();
  }
});

test('teacher admits a waiting guest through the meeting UI', async ({
  page,
  context,
}) => {
  const data = createMeetingClass('trusted');
  const guest = await context.newPage();
  try {
    await page.goto(entry(data.session, `handoff=${data.identities[0].handoff}`));
    await page.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meeting as Teacher' })).toBeVisible();
    await guest.goto(entry(data.session, `invite=${data.invite}`));
    await expect(guest.getByText('Waiting for approval', { exact: true })).toBeVisible();
    await page.bringToFront();
    await page.getByRole('button', { name: 'Admit Guest', exact: true }).click();
    await guest.bringToFront();
    await expect(guest.getByText('Waiting for approval', { exact: true })).toHaveCount(0);
    await guest.getByRole('button', { name: 'Join session', exact: true }).click();
    await expect(guest.getByRole('heading', { name: 'Meeting as Guest' })).toBeVisible();
  } finally {
    await guest.close();
    data.cleanup();
  }
});

test('concurrent retries redeem one handoff consistently', async ({ request }) => {
  const data = createMeetingClass();
  try {
    const path = `${api}/live-sessions/${data.session}/link-info`;
    const input = {
      data: {
        token: data.identities[1].handoff,
        handoff: true,
        redemptionKey: 'a'.repeat(32),
      },
    };
    const results = await Promise.all([
      request.post(path, input),
      request.post(path, input),
    ]);
    expect(results.every((response) => response.ok())).toBe(true);
    const values = await Promise.all(results.map((response) => response.json()));
    expect(values[0].linkToken === values[1].linkToken).toBe(true);
  } finally {
    data.cleanup();
  }
});

for (const mode of ['trusted', 'restricted'] as const)
  for (const role of ['Teacher', 'Staff'])
    test(`${role} bypasses ${mode} waiting room without a password`, async ({ page }) => {
      const data = createMeetingClass(mode);
      try {
        const identity = data.identities.find((item) => item.name === role)!;
        await page.goto(entry(data.session, `handoff=${identity.handoff}`));
        await expect(
          page.getByRole('group', { name: 'Your video preview' }),
        ).toBeVisible();
        await expect(page.getByLabel('Session passcode')).toHaveCount(0);
        await expect(page.getByText('Waiting for approval', { exact: true })).toHaveCount(
          0,
        );
        await page.getByRole('button', { name: 'Join session', exact: true }).click();
        await expect(
          page.getByRole('heading', { name: `Meeting as ${role}` }),
        ).toBeVisible();
      } finally {
        data.cleanup();
      }
    });
