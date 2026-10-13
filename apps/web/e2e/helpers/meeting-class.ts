import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
/** Synthetic local data only; never accepts a remote database or existing account. */
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
    { input: statement, encoding: 'utf8' },
  ).trim();
}
export function createMeetingClass(mode: 'open' | 'trusted' | 'restricted' = 'open') {
  const org = randomUUID(),
    channel = randomUUID(),
    session = randomUUID();
  const identities = ['Teacher', 'Student', 'Staff', 'Outsider'].map((name) => ({
    name,
    user: randomUUID(),
    account: randomUUID(),
    profile: randomUUID(),
    handoff: randomBytes(24).toString('base64url'),
  }));
  const invite = randomBytes(24).toString('base64url');
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  const settings = JSON.stringify({
    recording: { enabled: false, autoStart: false, allowStop: true },
    whiteboard: { enabled: false },
    invite: { enabled: true },
    participants: { visible: true },
    messages: { visible: true, enabled: true },
    access: { mode },
    cohosts: { enabled: true },
  });
  sql(`begin;
    insert into public.orgs(id,name,slug) values('${org}','Meeting E2E','meeting-e2e-${org}');
    ${identities.map((i) => `insert into auth.users(id) values('${i.user}'); insert into public.accounts(id,org_id,auth_user_id) values('${i.account}','${org}','${i.user}'); insert into public.profiles(id,org_id,account_id,kind,display_name,avatar_source,timezone) values('${i.profile}','${org}','${i.account}','${i.name === 'Teacher' ? 'educator' : i.name === 'Staff' ? 'staff' : 'child'}','${i.name}','seed','UTC');`).join('\n')}
    insert into public.channels(id,org_id,kind,topic,visibility,purpose) values('${channel}','${org}','channel','Meeting test class','private','learning-space');
    insert into public.channel_members(org_id,channel_id,profile_id) values('${org}','${channel}','${identities[0].profile}'),('${org}','${channel}','${identities[1].profile}');
    insert into public.channel_live_sessions(id,org_id,channel_id,provider,session_scope_key,status,started_by_profile_id,join_path,provider_metadata,app_metadata) values('${session}','${org}','${channel}','zoom','${session}','live','${identities[0].profile}','/live/${session}','{"sessionName":"e2e-${session}","sessionKey":"${session}","passcode":"DemoPass12"}','{"meetingSettings":${settings}}');
    ${identities.map((i) => `insert into public.live_session_browser_links(token_hash,live_session_id,purpose,auth_user_id,expires_at) values('${hash(i.handoff)}','${session}','handoff','${i.user}',now()+interval '1 minute');`).join('\n')}
    insert into public.live_session_browser_links(token_hash,live_session_id,purpose,passcode_hash,expires_at) values('${hash(invite)}','${session}','invite','${hash('DemoPass12')}',now()+interval '1 hour');
    commit;`);
  return {
    session,
    org,
    channel,
    identities,
    invite,
    end: () =>
      sql(
        `update public.channel_live_sessions set status='ended' where id='${session}';`,
      ),
    expireInvite: () =>
      sql(
        `update public.live_session_browser_links set expires_at=now()-interval '1 second' where token_hash='${hash(invite)}';`,
      ),
    rotatePasscode: () =>
      sql(
        `update public.channel_live_sessions set provider_metadata=jsonb_set(provider_metadata,'{passcode}','"NewPass123"') where id='${session}';`,
      ),
    cleanup: () =>
      sql(
        `delete from public.orgs where id='${org}';delete from auth.users where id in (${identities.map((i) => `'${i.user}'`).join(',')});`,
      ),
  };
}
