import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Explicitly opt in: these fixtures may only touch the disposable local Supabase stack.
test.describe('local parent invitation lifecycle', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
  test.skip(
    process.env.PLAYWRIGHT_REFERRALS_LOCAL !== '1',
    'Requires local Supabase and enabled referral rollout',
  );
  let admin: SupabaseClient;
  let local: Record<string, string>;
  const orgId = randomUUID();
  const slug = `referral-browser-${orgId}`;
  const accountId = randomUUID();
  const authIds: string[] = [];
  let code: string;
  let referrerEmail: string;
  const password = `${randomUUID()}Aa1!`;
  function loopback(value: string) {
    expect(['127.0.0.1', 'localhost', '[::1]']).toContain(new URL(value).hostname);
  }
  test.beforeAll(async ({ baseURL }) => {
    loopback(baseURL!);
    local = JSON.parse(
      execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
        cwd: '../..',
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
    loopback(local.API_URL);
    loopback(local.DB_URL);
    loopback(local.INBUCKET_URL);
    admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    referrerEmail = `referral-browser-${randomUUID()}@example.test`;
    const user = await admin.auth.admin.createUser({
      email: referrerEmail,
      password,
      email_confirm: true,
    });
    expect(user.error).toBeNull();
    authIds.push(user.data.user!.id);
    for (const [table, row] of [
      ['orgs', { id: orgId, slug, name: 'Browser Referral Test' }],
      [
        'accounts',
        {
          id: accountId,
          org_id: orgId,
          auth_user_id: authIds[0],
          email: referrerEmail,
          primary_role: 'guardian',
          status: 'active',
          onboarding_completed_at: new Date().toISOString(),
        },
      ],
      [
        'profiles',
        {
          org_id: orgId,
          account_id: accountId,
          kind: 'guardian',
          display_name: 'Browser Test Parent',
          avatar_source: 'seed',
        },
      ],
    ] as const)
      expect((await admin.from(table).insert(row)).error).toBeNull();
    const link = await admin.rpc('get_parent_referral_link', {
      actor_auth_id: authIds[0],
      target_org_id: orgId,
    });
    expect(link.error).toBeNull();
    code = link.data.code;
  });
  test.afterAll(async () => {
    if (!admin) return;
    for (const id of authIds.slice(1)) await admin.auth.admin.deleteUser(id);
    // IDs are generated locally above, never supplied by a user or an environment variable.
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
      ],
      {
        input: `delete from public.profiles where org_id='${orgId}'; delete from public.parent_referral_events where org_id='${orgId}'; delete from public.parent_referrals where org_id='${orgId}'; delete from public.parent_referral_links where org_id='${orgId}'; delete from public.profile_change_events where org_id='${orgId}'; delete from public.orgs where id='${orgId}';`,
        stdio: ['pipe', 'ignore', 'pipe'],
      },
    );
    if (authIds[0]) await admin.auth.admin.deleteUser(authIds[0]);
  });
  async function startSignup(page: Page) {
    const email = `referral-browser-${randomUUID()}@example.test`;
    // Next streams the form before its event handlers hydrate in development.
    await page.waitForFunction(() => {
      const input = document.querySelector('input[type=email]');
      return input && Object.keys(input).some((key) => key.startsWith('__reactProps'));
    });
    await page.getByPlaceholder('Email', { exact: true }).fill('');
    await page
      .getByPlaceholder('Email', { exact: true })
      .pressSequentially(email, { delay: 10 });
    await page.getByRole('button', { name: 'Get Started', exact: true }).click();
    await expect(page.getByLabel('Verification code')).toBeVisible();
    return email;
  }
  async function finishSignup(page: Page, email: string) {
    let otp = '';
    await expect
      .poll(
        async () => {
          const search = await fetch(
            `${local.INBUCKET_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
          );
          const inbox = await search.json();
          const message = inbox.messages?.[0];
          if (!message) return false;
          const detail = await (
            await fetch(`${local.INBUCKET_URL}/api/v1/message/${message.ID}`)
          ).json();
          otp = (detail.Text ?? '').match(/\b(\d{6})\b/)?.[1] ?? '';
          return Boolean(otp);
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await page.getByLabel('Verification code').fill(otp);
    await page.getByRole('button', { name: /Verify|Continue/ }).click();
    await page.getByRole('radio', { name: /^Parent/ }).check();
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/onboarding/role' &&
        r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    expect((await response).ok()).toBe(true);
    const users = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = users.data.users.find((u) => u.email === email)!;
    expect(user).toBeTruthy();
    authIds.push(user.id);
    const accounts = await admin
      .from('accounts')
      .select('id')
      .eq('auth_user_id', user.id);
    expect(accounts.error).toBeNull();
    const claims = await admin
      .from('parent_referrals')
      .select('status,referrer_account_id')
      .in(
        'referred_account_id',
        accounts.data!.map((a) => a.id),
      );
    expect(claims.error).toBeNull();
    return claims.data!;
  }
  test('invitation benefits, footer badges, and leaving before acceptance', async ({
    page,
  }) => {
    await page.goto(`/r/${code}`);
    await expect(
      page.getByRole('heading', { name: 'Support your child’s next step' }),
    ).toBeVisible();
    const options = page.getByRole('region', { name: 'Continue in the app' });
    for (const [name, host] of [
      ['Download on the App Store', 'apps.apple.com'],
      ['Get it on Google Play', 'play.google.com'],
    ]) {
      const badge = options.getByRole('link', { name });
      expect(new URL((await badge.getAttribute('href'))!).hostname).toBe(host);
      await expect(badge.locator('svg')).toHaveCount(1);
      await page
        .context()
        .route(`https://${host}/**`, (route) =>
          route.fulfill({ status: 200, body: 'Store destination' }),
        );
      const popup = page.waitForEvent('popup');
      await badge.click();
      const store = await popup;
      await store.waitForLoadState();
      expect(new URL(store.url()).hostname).toBe(host);
      await store.close();
    }
    await expect(
      options.getByRole('link', { name: 'Open app and continue' }),
    ).toHaveAttribute('href', `iconicedu://r/${code}`);
    await page.locator('header a[href="/"]').first().click();
    await expect
      .poll(
        async () =>
          (await page.context().cookies()).find(
            (c) => c.name === 'iconic-parent-referral-cancelled',
          )?.value,
      )
      .toBe(code);
  });
  test('accepted invitation creates one pending reward', async ({ page }) => {
    await page.goto(`/r/${code}`);
    await page.getByRole('button', { name: 'Continue on the web' }).click();
    const email = await startSignup(page);
    expect(await finishSignup(page, email)).toEqual([
      { status: 'pending_review', referrer_account_id: accountId },
    ]);
    await page.goto(`/r/${code}`);
    await expect(
      page.getByRole('heading', { name: 'Invitations are for new parents' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue on the web' })).toHaveCount(
      0,
    );
  });
  test('back from verification clears invitation and ordinary signup creates no reward', async ({
    page,
  }) => {
    await page.goto(`/r/${code}`);
    await page.getByRole('button', { name: 'Continue on the web' }).click();
    const abandoned = await startSignup(page);
    await page.getByRole('link', { name: 'Use a different email' }).click();
    await expect
      .poll(async () =>
        (await page.context().cookies()).some((c) => c.name === 'iconic-parent-referral'),
      )
      .toBe(false);
    const email = await startSignup(page);
    expect(await finishSignup(page, email)).toEqual([]);
    const users = await admin.auth.admin.listUsers({ perPage: 1000 });
    const abandonedUser = users.data.users.find((u) => u.email === abandoned);
    if (abandonedUser) authIds.push(abandonedUser.id);
  });
});
