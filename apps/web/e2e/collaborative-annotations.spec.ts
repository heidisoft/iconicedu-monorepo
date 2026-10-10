import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
function sql(statement: string) {
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_iconicedu-monorepo',
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { input: statement, stdio: ['pipe', 'pipe', 'pipe'] },
  );
}
function fixture() {
  const org = randomUUID(),
    channel = randomUUID(),
    sessionId = randomUUID();
  const actors = ['educator', 'child'].map((kind) => ({
    kind,
    user: randomUUID(),
    account: randomUUID(),
    profile: randomUUID(),
    email: `annotation-${randomUUID()}@example.test`,
    password: randomBytes(24).toString('base64url'),
  }));
  sql(`begin;
    insert into public.orgs(id,name,slug) values ('${org}','Annotation E2E','annotation-e2e-${org}');
    ${actors
      .map(
        (actor) => `
      insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
      values ('00000000-0000-0000-0000-000000000000','${actor.user}','authenticated','authenticated','${actor.email}',extensions.crypt('${actor.password}',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
      insert into public.accounts(id,org_id,auth_user_id) values ('${actor.account}','${org}','${actor.user}');
      insert into public.profiles(id,org_id,account_id,kind,display_name,avatar_source,timezone) values ('${actor.profile}','${org}','${actor.account}','${actor.kind}','Test ${actor.kind}','seed','UTC');
    `,
      )
      .join('')}
    insert into public.channels(id,org_id,kind,topic,visibility,purpose) values ('${channel}','${org}','channel','Annotation class','private','learning-space');
    insert into public.channel_members(org_id,channel_id,profile_id) values ('${org}','${channel}','${actors[1].profile}');
    insert into public.channel_live_sessions(id,org_id,channel_id,provider,status,session_scope_key,started_by_profile_id,join_path) values ('${sessionId}','${org}','${channel}','zoom','live','${sessionId}','${actors[0].profile}','/live/test');
    commit;`);
  return {
    sessionId,
    actors,
    cleanup: () =>
      sql(
        `delete from public.orgs where id='${org}'; delete from auth.users where id in ('${actors[0].user}','${actors[1].user}');`,
      ),
  };
}
async function join(
  browser: Browser,
  entry: { email: string; password: string; sessionId: string; annotationToken?: string },
) {
  const context = await browser.newContext();
  await context.addInitScript(
    (value) => sessionStorage.setItem('annotation-test-entry', JSON.stringify(value)),
    entry,
  );
  const page = await context.newPage();
  await page.goto('/visual-test/collaborative-annotations');
  let release!: () => void;
  const snapshotGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/screen-annotations\//, async (route) => {
    await snapshotGate;
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Join annotation test' }).click();
    await expect(
      page.getByRole('button', { name: 'Open annotation toolbar' }),
    ).toBeVisible();
  } finally {
    release();
  }

  await expect(page.getByLabel('Annotation connection')).toHaveText('Connected', {
    timeout: 20000,
  });
  return { context, page };
}
async function draw(page: Page, viewer?: Page) {
  const opener = page.getByRole('button', { name: 'Open annotation toolbar' });
  if (await opener.isVisible()) await opener.click();
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  const bounds = await page.locator('[data-shared-content-bounds]').boundingBox();
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.2,
    bounds!.y + bounds!.height * 0.2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.4,
    bounds!.y + bounds!.height * 0.4,
    { steps: 10 },
  );
  if (viewer)
    await expect(viewer.getByLabel('Live preview marks')).toHaveText('1', {
      timeout: 5000,
    });
  await page.mouse.up();
}
async function pointerLabels(page: Page) {
  return page.evaluate(() => {
    const konva = (
      window as unknown as {
        Konva?: {
          stages: Array<{
            find(
              selector: string,
            ): Array<{ findOne(selector: string): { text(): string } }>;
          }>;
        };
      }
    ).Konva;
    return (
      konva?.stages.flatMap((stage) =>
        stage.find('Label').map((label) => label.findOne('Text').text()),
      ) ?? []
    );
  });
}
async function enableNames(page: Page) {
  const opener = page.getByRole('button', { name: 'Open annotation toolbar' });
  if (await opener.count()) await opener.click();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const names = page.getByRole('checkbox', { name: 'Show annotator names' });
  await expect(names).not.toBeChecked();
  await names.check();
  await page.getByRole('button', { name: 'More', exact: true }).click();
}
async function hoverAnnotation(page: Page) {
  const open = page.getByRole('button', { name: 'Open annotation toolbar' });
  if (await open.count()) await open.click();
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  const bounds = (await page.locator('[data-shared-content-bounds]').boundingBox())!;
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/pointer?') && response.status() === 204,
    ),
    page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.3),
  ]);
}

test('synchronizes annotations in both directions and survives presenter view remounts', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const data = fixture();
  try {
    const teacher = await join(browser, { ...data.actors[0], sessionId: data.sessionId });
    const participant = await join(browser, {
      ...data.actors[1],
      sessionId: data.sessionId,
    });
    await hoverAnnotation(teacher.page);
    expect(await pointerLabels(participant.page)).toEqual([]);
    await enableNames(participant.page);
    await expect.poll(() => pointerLabels(participant.page)).toContain('Test educator');
    await enableNames(teacher.page);
    await hoverAnnotation(participant.page);
    await expect.poll(() => pointerLabels(teacher.page)).toContain('Test child');
    await draw(teacher.page, participant.page);
    await expect(participant.page.getByLabel('Synchronized marks')).toHaveText('1', {
      timeout: 5000,
    });
    await draw(participant.page);
    await expect(teacher.page.getByLabel('Synchronized marks')).toHaveText('2', {
      timeout: 5000,
    });
    await teacher.page.getByRole('button', { name: 'Hide shared screen' }).click();
    await teacher.page.getByRole('button', { name: 'Show shared screen' }).click();
    await expect(teacher.page.getByLabel('Synchronized marks')).toHaveText('2');
    await expect(participant.page.getByLabel('Synchronized marks')).toHaveText('2');
    await draw(teacher.page);
    await expect(participant.page.getByLabel('Synchronized marks')).toHaveText('3', {
      timeout: 5000,
    });
    await expect
      .poll(() =>
        participant.page.locator('.konvajs-content canvas').evaluateAll((canvases) =>
          canvases.some((node) => {
            const canvas = node as HTMLCanvasElement;
            const pixels = canvas
              .getContext('2d')
              ?.getImageData(0, 0, canvas.width, canvas.height).data;
            if (!pixels) return false;
            for (let index = 0; index < pixels.length; index += 4)
              if (pixels[index + 3] > 0) return true;
            return false;
          }),
        ),
      )
      .toBe(true);
    await teacher.context.close();
    await participant.context.close();
  } finally {
    data.cleanup();
  }
});

test('shared-link guest sees presenter marks and draws without an account session', async ({
  browser,
}) => {
  const data = fixture();
  try {
    const teacher = await join(browser, { ...data.actors[0], sessionId: data.sessionId });
    const token = randomBytes(32).toString('base64url');
    sql(
      `insert into public.screen_annotation_access(live_session_id,token_hash,display_name,expires_at) values ('${data.sessionId}','${createHash('sha256').update(token).digest('hex')}','Guest',now()+interval '1 hour');`,
    );
    const guest = await join(browser, {
      email: '',
      password: '',
      sessionId: data.sessionId,
      annotationToken: token,
    });
    await hoverAnnotation(teacher.page);
    expect(await pointerLabels(guest.page)).toEqual([]);
    await enableNames(guest.page);
    await expect.poll(() => pointerLabels(guest.page)).toContain('Test educator');
    await enableNames(teacher.page);
    await hoverAnnotation(guest.page);
    await expect.poll(() => pointerLabels(teacher.page)).toContain('Guest');
    await teacher.page.getByRole('button', { name: 'Attention', exact: true }).click();
    await teacher.page.getByRole('button', { name: 'Spotlight', exact: true }).click();
    const edge = (await teacher.page
      .locator('[data-shared-content-bounds]')
      .boundingBox())!;
    await Promise.all([
      teacher.page.waitForResponse(
        (response) => response.url().includes('/pointer?') && response.status() === 204,
      ),
      teacher.page.mouse.move(edge.x + edge.width - 8, edge.y + edge.height - 8),
    ]);
    await expect.poll(() => pointerLabels(guest.page)).toContain('Test educator');
    await draw(teacher.page);
    await expect(guest.page.getByLabel('Synchronized marks')).toHaveText('1');
    await draw(guest.page);
    await expect(teacher.page.getByLabel('Synchronized marks')).toHaveText('2');
    await expect(guest.page.getByText('Not authenticated', { exact: true })).toHaveCount(
      0,
    );
    await teacher.context.close();
    await guest.context.close();
  } finally {
    data.cleanup();
  }
});

test('shares screen laser trails with signed-in participants and shared-link guests without saving marks', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const data = fixture();
  const contexts = [];
  try {
    const teacher = await join(browser, { ...data.actors[0], sessionId: data.sessionId });
    contexts.push(teacher.context);
    const participant = await join(browser, {
      ...data.actors[1],
      sessionId: data.sessionId,
    });
    contexts.push(participant.context);
    const token = randomBytes(32).toString('base64url');
    sql(
      `insert into public.screen_annotation_access(live_session_id,token_hash,display_name,expires_at) values ('${data.sessionId}','${createHash('sha256').update(token).digest('hex')}','Laser guest',now()+interval '1 hour');`,
    );
    const guest = await join(browser, {
      email: '',
      password: '',
      sessionId: data.sessionId,
      annotationToken: token,
    });
    contexts.push(guest.context);
    for (const [sender, viewers] of [
      [teacher.page, [participant.page, guest.page]],
      [guest.page, [teacher.page, participant.page]],
    ] as const) {
      const open = sender.getByRole('button', { name: 'Open annotation toolbar' });
      if (await open.count()) await open.click();
      await sender.getByRole('button', { name: 'Laser pointer', exact: true }).click();
      const bounds = (await sender
        .locator('[data-shared-content-bounds]')
        .boundingBox())!;
      await sender.mouse.move(
        bounds.x + bounds.width * 0.3,
        bounds.y + bounds.height * 0.3,
      );
      await sender.mouse.down();
      for (let step = 1; step <= 12; step++) {
        await sender.mouse.move(
          bounds.x + bounds.width * (0.3 + step * 0.015),
          bounds.y + bounds.height * (0.3 + step * 0.01),
        );
        await sender.waitForTimeout(40);
      }
      for (const viewer of viewers)
        await expect(viewer.getByLabel('Live preview marks')).toHaveText('1');
      await sender.mouse.up();
      for (const viewer of viewers) {
        await expect(viewer.getByLabel('Laser trails')).toHaveText('1');
        await expect
          .poll(() =>
            viewer.locator('.konvajs-content canvas').evaluateAll((canvases) =>
              canvases.some((node) => {
                const canvas = node as HTMLCanvasElement;
                const pixels = canvas
                  .getContext('2d')
                  ?.getImageData(0, 0, canvas.width, canvas.height).data;
                return (
                  pixels?.some((value, index) => index % 4 === 3 && value > 0) ?? false
                );
              }),
            ),
          )
          .toBe(true);
        await expect(viewer.getByLabel('Synchronized marks')).toHaveText('0');
      }
      for (const viewer of [sender, ...viewers]) {
        await expect(viewer.getByLabel('Laser trails')).toHaveText('0', {
          timeout: 6000,
        });
        await expect(viewer.getByLabel('Live preview marks')).toHaveText('0');
      }
    }
    // A canceled guest laser must disappear promptly through the API fallback.
    const bounds = (await guest.page
      .locator('[data-shared-content-bounds]')
      .boundingBox())!;
    await guest.page.mouse.move(
      bounds.x + bounds.width * 0.3,
      bounds.y + bounds.height * 0.3,
    );
    await guest.page.mouse.down();
    await guest.page.mouse.move(
      bounds.x + bounds.width * 0.5,
      bounds.y + bounds.height * 0.5,
      { steps: 8 },
    );
    await expect(teacher.page.getByLabel('Live preview marks')).toHaveText('1');
    await guest.page.keyboard.press('Escape');
    await guest.page.mouse.up();
    await expect(teacher.page.getByLabel('Live preview marks')).toHaveText('0', {
      timeout: 2000,
    });
    await expect(teacher.page.getByLabel('Synchronized marks')).toHaveText('0');
  } finally {
    for (const context of contexts) await context.close();
    data.cleanup();
  }
});
