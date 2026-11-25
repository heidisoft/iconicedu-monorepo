import type { MessageVM } from '@iconicedu/shared-types';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient, type Session } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { expect, type Browser, type APIRequestContext } from '@playwright/test';

export const senderRoles = [
  'owner',
  'admin',
  'staff',
  'guardian',
  'child',
  'educator',
] as const;
export type SenderRole = (typeof senderRoles)[number];
export type Persona = {
  role: SenderRole;
  name: string;
  user: string;
  account: string;
  profile: string;
  session: Session;
};

export function localUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('Audience E2E requires local HTTP services');
  return url.origin;
}

// Host-side fixtures only. Never import this helper into application code.
function sql(statement: string) {
  return execFileSync(
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
    { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}

export async function createAudienceFixture() {
  const status = JSON.parse(
    execFileSync('supabase', ['status', '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
  const authUrl = localUrl(status.API_URL);
  const apiUrl = localUrl(process.env.AUDIENCE_API_URL ?? 'http://127.0.0.1:3101');
  const webUrl = localUrl(process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100');
  const admin = createClient(authUrl, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const org = randomUUID(),
    channel = randomUUID(),
    otherOrg = randomUUID();
  const slug = `audience-e2e-${org}`;
  const users: string[] = [];
  const members: Persona[] = [];
  const cleanup = async () => {
    sql(`delete from public.orgs where id in ('${org}','${otherOrg}');`);
    for (const id of users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error('Audience fixture auth cleanup failed');
    }
  };
  try {
    sql(`insert into public.orgs(id,name,slug) values ('${org}','Audience E2E','${slug}'),('${otherOrg}','Audience outsider','audience-e2e-${otherOrg}');
      insert into public.channels(id,org_id,kind,topic,visibility,purpose) values ('${channel}','${org}','channel','Audience E2E','private','general');`);
    for (const [index, role] of [
      ...senderRoles,
      'guardian',
      'guardian',
      'guardian',
    ].entries()) {
      const email = `audience-e2e-${randomUUID()}@example.test`,
        password = randomUUID();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user)
        throw new Error('Unable to provision synthetic audience identity');
      users.push(data.user.id);
      const account = randomUUID(),
        profile = randomUUID();
      const name =
        index === 6
          ? 'Peer Parent'
          : index === 7
            ? 'Nonmember'
            : index === 8
              ? 'Other Org'
              : `E2E ${role}`;
      const kind = ['owner', 'admin'].includes(role) ? 'staff' : role;
      const orgId = index === 8 ? otherOrg : org;
      sql(`delete from public.accounts where auth_user_id='${data.user.id}';
        insert into public.accounts(id,org_id,auth_user_id,email,email_verified,phone_e164,phone_verified,onboarding_completed_at) values ('${account}','${orgId}','${data.user.id}','${email}',true,'+1202555010${index}',true,now());
        insert into public.user_roles(org_id,account_id,role_key) values ('${orgId}','${account}','${role}');
        insert into public.profiles(id,org_id,account_id,kind,display_name,first_name,last_name,avatar_source,timezone,city,region,country_code,postal_code) values ('${profile}','${orgId}','${account}','${kind}','${name}','E2E','${role}','seed','America/New_York','New York','New York','US','10001');
        ${index < 7 ? `insert into public.channel_members(org_id,channel_id,profile_id) values ('${org}','${channel}','${profile}');` : ''}`);
      if (kind === 'staff')
        sql(
          `insert into public.staff_profiles(profile_id,org_id,weekly_availability) values ('${profile}','${orgId}','{"Mon":[18]}'::jsonb);`,
        );
      if (kind === 'child')
        sql(
          `insert into public.child_profiles(profile_id,org_id,birth_year) values ('${profile}','${orgId}',2015); insert into public.child_profile_grade_level(profile_id,org_id,grade_id) values ('${profile}','${orgId}','grade_5');`,
        );
      if (kind === 'educator')
        sql(
          `insert into public.educator_profiles(profile_id,org_id) values ('${profile}','${orgId}'); insert into public.educator_profile_subjects(profile_id,org_id,subject) values ('${profile}','${orgId}','Math'); insert into public.educator_profile_grade_levels(profile_id,org_id,grade_id) values ('${profile}','${orgId}','grade_5'); insert into public.educator_availabilities(profile_id,org_id,availability) values ('${profile}','${orgId}','{"Mon":[18]}'::jsonb);`,
        );
      if (kind === 'guardian') {
        const childAccount = randomUUID(),
          childProfile = randomUUID(),
          family = randomUUID();
        // A separate non-channel child per family prevents implicit family visibility from weakening the exclusion checks.
        sql(
          `insert into public.accounts(id,org_id) values ('${childAccount}','${orgId}'); insert into public.profiles(id,org_id,account_id,kind,display_name,avatar_source,timezone) values ('${childProfile}','${orgId}','${childAccount}','child','Fixture child','seed','America/New_York'); insert into public.families(id,org_id,display_name) values ('${family}','${orgId}','Fixture family'); insert into public.family_links(org_id,family_id,guardian_account_id,child_account_id,relation) values ('${orgId}','${family}','${account}','${childAccount}','guardian');`,
        );
      }
      const client = createClient(authUrl, status.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signedIn = await client.auth.signInWithPassword({ email, password });
      if (signedIn.error || !signedIn.data.session)
        throw new Error('Synthetic audience sign-in failed');
      members.push({
        role: role as SenderRole,
        name,
        user: data.user.id,
        account,
        profile,
        session: signedIn.data.session,
      });
    }
    return {
      org,
      channel,
      apiUrl,
      members: members.slice(0, 7),
      nonmember: members[7],
      outsider: members[8],
      cleanup,
      async open(browser: Browser, persona: Persona) {
        const context = await browser.newContext({ baseURL: webUrl });
        context.setDefaultTimeout(15000);
        context.setDefaultNavigationTimeout(60000);
        const auth = createServerClient(authUrl, status.ANON_KEY, {
          cookies: {
            getAll: () => [],
            setAll: async (cookies) => {
              await context.addCookies(
                cookies.map(({ name, value }) => ({ name, value, url: webUrl })),
              );
            },
          },
        });
        const { error } = await auth.auth.setSession(persona.session);
        if (error) throw new Error('Unable to establish browser session');
        const page = await context.newPage();
        let subscribed = false;
        page.on('websocket', (socket) =>
          socket.on('framereceived', ({ payload }) => {
            try {
              const frame = JSON.parse(String(payload)) as
                | { topic?: string; event?: string; payload?: { status?: string } }
                | unknown[];
              const topic = Array.isArray(frame) ? frame[2] : frame.topic;
              const event = Array.isArray(frame) ? frame[3] : frame.event;
              const response = Array.isArray(frame) ? frame[4] : frame.payload;
              if (
                topic === `realtime:messages:${channel}` &&
                event === 'phx_reply' &&
                response &&
                typeof response === 'object' &&
                'status' in response &&
                response.status === 'ok'
              )
                subscribed = true;
            } catch {
              /* Ignore non-Phoenix frames; never log auth/session traffic. */
            }
          }),
        );
        page.on('pageerror', (error) =>
          console.info('Audience browser error:', error.message),
        );
        await page.goto(`/${slug}/c/${channel}`, { waitUntil: 'domcontentloaded' });
        // SSR exposes the controls before the app has completed its initial client queries.
        await page.waitForLoadState('networkidle', { timeout: 60000 });
        await expect
          .poll(() => subscribed, {
            timeout: 30000,
            message: 'Authenticated messages subscription joined',
          })
          .toBe(true);
        await expect(page.getByRole('button', { name: /Message audience:/ })).toBeVisible(
          { timeout: 60000 },
        );
        return { context, page };
      },
      async history(
        request: APIRequestContext,
        persona: Persona,
        profileId = persona.profile,
      ) {
        const response = await request.get(`${apiUrl}/messages`, {
          headers: { Authorization: `Bearer ${persona.session.access_token}` },
          params: {
            orgId: org,
            channelId: channel,
            profileId,
            accountId: persona.account,
            limit: 100,
          },
        });
        expect(response.status()).toBe(200);
        return response.json() as Promise<MessageVM[]>;
      },
      threadId(messageId: string) {
        if (!/^[0-9a-f-]{36}$/i.test(messageId))
          throw new Error('Invalid fixture message id');
        return sql(
          `select id from public.threads where org_id='${org}' and parent_message_id='${messageId}';`,
        );
      },
      unread(persona: Persona) {
        return Number(
          sql(
            `select coalesce(sum(unread_count),0) from public.channel_read_state where channel_id='${channel}' and account_id='${persona.account}' and thread_id is null;`,
          ),
        );
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
export type AudienceFixture = Awaited<ReturnType<typeof createAudienceFixture>>;
