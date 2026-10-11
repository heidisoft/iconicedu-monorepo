import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const env = JSON.parse(
  execFileSync('supabase', ['status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(env.API_URL).hostname))
  throw new Error('This test requires local Supabase');
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const org = randomUUID();
const channel = randomUUID();
const live = randomUUID();
const users = [];
const clients = [];
const must = (response) => {
  if (response.error) throw new Error(response.error.message);
  return response.data;
};
const subscription = (channel) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Realtime subscription timeout')),
      12000,
    );
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve(channel);
      } else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
        clearTimeout(timeout);
        reject(error ?? new Error(status));
      }
    });
  });
try {
  must(
    await service.from('orgs').insert({
      id: org,
      name: 'Synthetic annotation test',
      slug: `annotation-test-${org}`,
    }),
  );
  for (const role of ['educator', 'child']) {
    const password = `Synthetic-${randomUUID()}`;
    const email = `annotation-${randomUUID()}@example.invalid`;
    const created = must(
      await service.auth.admin.createUser({ email, password, email_confirm: true }),
    );
    const user = created.user.id;
    users.push(user);
    const account = randomUUID();
    const profile = randomUUID();
    must(
      await service
        .from('accounts')
        .insert({ id: account, org_id: org, auth_user_id: user }),
    );
    must(
      await service.from('profiles').insert({
        id: profile,
        org_id: org,
        account_id: account,
        kind: role,
        display_name: `Synthetic ${role}`,
        avatar_source: 'seed',
        timezone: 'UTC',
      }),
    );
    const client = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false },
    });
    clients.push({ client, user, profile });
    const signed = must(await client.auth.signInWithPassword({ email, password }));
    await client.realtime.setAuth(signed.session.access_token);
  }
  must(
    await service.from('channels').insert({
      id: channel,
      org_id: org,
      kind: 'channel',
      topic: 'Synthetic annotation test',
      visibility: 'private',
      purpose: 'learning-space',
    }),
  );
  must(
    await service.from('channel_members').insert(
      clients.map((actor) => ({
        org_id: org,
        channel_id: channel,
        profile_id: actor.profile,
      })),
    ),
  );
  must(
    await service.from('channel_live_sessions').insert({
      id: live,
      org_id: org,
      channel_id: channel,
      provider: 'zoom',
      status: 'live',
      session_scope_key: `test-${live}`,
      join_path: `/live/${live}`,
      started_by_profile_id: clients[0].profile,
    }),
  );
  const context = must(
    await service.rpc('screen_annotation_context', {
      p_session: live,
      p_user: users[0],
      p_share: '123',
    }),
  );
  const room = context.snapshot.roomId;
  must(
    await service.rpc('screen_annotation_apply', {
      p_room: room,
      p_user: users[0],
      p_operation: { eventId: randomUUID(), kind: 'permissions', enabled: true },
    }),
  );
  let previewReceived;
  const previewPromise = new Promise((resolve) => {
    previewReceived = resolve;
  });
  await subscription(
    clients[0].client
      .channel(`annotation:room:${room}:user:${users[1]}`, {
        config: { private: true, broadcast: { ack: true } },
      })
      .on('broadcast', { event: 'annotation.preview' }, ({ payload }) =>
        previewReceived(payload),
      ),
  );
  const own = await subscription(
    clients[1].client.channel(`annotation:room:${room}:user:${users[1]}`, {
      config: { private: true, broadcast: { ack: true } },
    }),
  );
  const payload = {
    eventId: randomUUID(),
    roomId: room,
    kind: 'pointer',
    userId: users[1],
    annotationId: 'pointer',
    clientId: 'synthetic',
    sequence: 1,
    timestamp: Date.now(),
    point: { x: 0.2, y: 0.3 },
    tool: 'spotlight',
  };
  assert.equal(
    await own.send({ type: 'broadcast', event: 'annotation.preview', payload }),
    'ok',
  );
  assert.deepEqual(
    await Promise.race([
      previewPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Preview delivery timeout')), 5000),
      ),
    ]),
    payload,
  );
  let commitReceived;
  const commitPromise = new Promise((resolve) => {
    commitReceived = resolve;
  });
  const state = await subscription(
    clients[1].client
      .channel(`annotation:room:${room}`, {
        config: { private: true, broadcast: { ack: true } },
      })
      .on('broadcast', { event: 'annotation.commit' }, ({ payload }) =>
        commitReceived(payload),
      ),
  );
  const forged = await state.send({
    type: 'broadcast',
    event: 'annotation.commit',
    payload: { revision: 999, ended: true },
  });
  assert.notEqual(forged, 'ok', 'Receive-only state topic must reject forged commits');
  const operation = { eventId: randomUUID(), kind: 'permissions', enabled: false };
  const committed = must(
    await service.rpc('screen_annotation_apply', {
      p_room: room,
      p_user: users[0],
      p_operation: operation,
    }),
  );
  assert.equal(
    (
      await Promise.race([
        commitPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Commit delivery timeout')), 5000),
        ),
      ])
    ).revision,
    committed.revision,
  );
  console.log(
    'PASS: private preview delivery, forged commit rejection, transactional commit delivery',
  );
} finally {
  for (const { client } of clients) {
    await client.removeAllChannels();
    await client.auth.signOut();
  }
  await service.from('orgs').delete().eq('id', org);
  for (const user of users) await service.auth.admin.deleteUser(user);
}
