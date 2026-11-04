import { resolveChannelLiveSessionScope } from '@iconicedu/live-sessions-core';
import {
  ClassroomCallsService,
  callView,
  eligibleClassMember,
} from './classroom-calls.service';
import { parseClassroomPresence } from './classroom-calls.controller';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { sendPushNotification } from '@iconicedu/api/lib/notifications/providers/push-provider';
jest.mock('@iconicedu/live-sessions-core', () => ({
  resolveChannelLiveSessionScope: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/flags/posthog-openfeature', () => ({
  evaluateApiBooleanFlag: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/notifications/providers/push-provider', () => ({
  sendPushNotification: jest.fn(),
}));
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type Row = Record<string, unknown>;
let rows: Record<string, Row[]>;
let authId: string;
let rpc: jest.Mock;
class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private operation = '';
  private value: Row | Row[] = {};
  private single = false;
  constructor(private table: string) {}
  select() {
    return this;
  }
  eq(k: string, v: unknown) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  is(k: string, v: unknown) {
    this.filters.push((r) => (r[k] ?? null) === v);
    return this;
  }
  in(k: string, v: unknown[]) {
    this.filters.push((r) => v.includes(r[k]));
    return this;
  }
  gt(k: string, v: string) {
    this.filters.push((r) => String(r[k]) > v);
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  update(v: Row) {
    this.operation = 'update';
    this.value = v;
    return this;
  }
  upsert(v: Row[]) {
    this.operation = 'upsert';
    this.value = v;
    return this;
  }
  delete() {
    this.operation = 'delete';
    return this;
  }
  then(resolve: (r: { data: Row | Row[] | null; error: null }) => unknown) {
    const matches = (rows[this.table] ?? []).filter((r) =>
      this.filters.every((f) => f(r)),
    );
    if (this.operation === 'update')
      for (const r of matches) Object.assign(r, this.value);
    if (this.operation === 'upsert')
      rows[this.table] = [...(rows[this.table] ?? []), ...(this.value as Row[])];
    if (this.operation === 'delete')
      rows[this.table] = (rows[this.table] ?? []).filter((r) => !matches.includes(r));
    return Promise.resolve(
      resolve({ data: this.single ? (matches[0] ?? null) : matches, error: null }),
    );
  }
}
const teacher = {
  id: id(1),
  account_id: id(11),
  kind: 'educator',
  display_name: 'Test teacher',
  org_id: id(100),
};
const student = {
  id: id(2),
  account_id: id(12),
  kind: 'child',
  display_name: 'Test student',
  org_id: id(100),
};
const guardian = {
  id: id(3),
  account_id: id(13),
  kind: 'guardian',
  display_name: 'Test guardian',
  org_id: id(100),
};
const sessionId = id(50);
const invite = () => ({
  id: id(80),
  live_session_id: sessionId,
  caller_profile_id: teacher.id,
  recipient_profile_id: student.id,
  status: 'ringing' as const,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 45_000).toISOString(),
});
const channels = { ensureDirectMessageChannel: jest.fn() };
const service = () => new ClassroomCallsService(channels as never);
beforeEach(() => {
  jest.clearAllMocks();
  authId = 'teacher-auth';
  channels.ensureDirectMessageChannel.mockResolvedValue({ channelId: id(200) });
  jest.mocked(resolveChannelLiveSessionScope).mockResolvedValue({
    schedule: { ids: { id: id(70) } },
    occurrenceKey: new Date(
      Math.floor(Date.now() / 60_000) * 60_000 - 5 * 60_000,
    ).toISOString(),
    occurrenceEndAt: new Date(Date.now() + 55 * 60_000).toISOString(),
  } as never);
  rows = {
    orgs: [{ id: id(100), slug: 'test-academy' }],
    accounts: [
      { id: teacher.account_id, org_id: id(100), auth_user_id: 'teacher-auth' },
      { id: student.account_id, org_id: id(100), auth_user_id: 'student-auth' },
      { id: guardian.account_id, org_id: id(100), auth_user_id: 'guardian-auth' },
    ],
    profiles: [teacher, student, guardian],
    family_links: [
      {
        org_id: id(100),
        guardian_account_id: guardian.account_id,
        child_account_id: student.account_id,
      },
    ],
    channel_live_sessions: [
      {
        id: sessionId,
        org_id: id(100),
        channel_id: id(60),
        status: 'live',
        share_code: 'aaaa1111bbbb',
        occurrence_key: new Date(
          Math.floor(Date.now() / 60_000) * 60_000 - 5 * 60_000,
        ).toISOString(),
        app_metadata: { scheduleId: id(70) },
      },
    ],
    channel_members: [teacher, student, guardian].map((p) => ({
      org_id: id(100),
      channel_id: id(60),
      profile_id: p.id,
    })),
    channels: [{ id: id(60), org_id: id(100), topic: 'Test class' }],
    user_roles: [],
    classroom_call_presence: [
      {
        live_session_id: sessionId,
        profile_id: teacher.id,
        last_seen_at: new Date().toISOString(),
      },
    ],
    classroom_call_invitations: [],
  };
  rpc = jest
    .fn()
    .mockReturnValue({ single: jest.fn(async () => ({ data: invite(), error: null })) });
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue({ from: (table: string) => new Query(table), rpc } as never);
  jest.mocked(createSupabaseSessionClient).mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: authId } }, error: null }) },
  } as never);
  jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(true);
  jest
    .mocked(sendPushNotification)
    .mockResolvedValue({ ticketIds: [], revokedTokenIds: [] });
});
it('returns the complete enrolled roster while excluding accidental staff/admin/system accounts', async () => {
  const staff = { ...student, id: id(4), account_id: id(14), kind: 'staff' };
  const admin = { ...teacher, id: id(5), account_id: id(15) };
  const system = { ...student, id: id(6), kind: 'system' };
  rows.profiles.push(staff, admin, system);
  rows.channel_members.push(
    ...[staff, admin, system].map((p) => ({
      org_id: id(100),
      channel_id: id(60),
      profile_id: p.id,
    })),
  );
  rows.user_roles.push({
    org_id: id(100),
    account_id: admin.account_id,
    role_key: 'admin',
  });
  const roster = await service().roster('synthetic', sessionId);
  expect(roster.members.map((p) => p.profileId)).toEqual([
    teacher.id,
    student.id,
    guardian.id,
  ]);
  expect(roster.members.find((p) => p.profileId === student.id)).toMatchObject({
    joined: false,
    canCall: true,
  });
});
it('requires the flag, class membership, teacher identity and an active class connection', async () => {
  jest.mocked(evaluateApiBooleanFlag).mockResolvedValueOnce(false);
  await expect(service().ring('synthetic', sessionId, student.id)).rejects.toThrow(
    'not available',
  );
  authId = 'student-auth';
  await expect(service().ring('synthetic', sessionId, guardian.id)).rejects.toThrow(
    'class teacher',
  );
  authId = 'teacher-auth';
  rows.classroom_call_presence = [];
  await expect(service().ring('synthetic', sessionId, student.id)).rejects.toThrow(
    'class teacher',
  );
  rows.channel_members = rows.channel_members.filter((r) => r.profile_id !== teacher.id);
  await expect(service().roster('synthetic', sessionId)).rejects.toThrow('membership');
  expect(sendPushNotification).not.toHaveBeenCalled();
});
it('does not allow cross-class, already joined or self calls', async () => {
  await expect(service().ring('synthetic', sessionId, id(999))).rejects.toThrow(
    'enrolled',
  );
  await expect(service().ring('synthetic', sessionId, teacher.id)).rejects.toThrow(
    'enrolled',
  );
  rows.classroom_call_presence.push({
    live_session_id: sessionId,
    profile_id: student.id,
    last_seen_at: new Date().toISOString(),
  });
  await expect(service().ring('synthetic', sessionId, student.id)).rejects.toThrow(
    'already joined',
  );
  expect(rpc).not.toHaveBeenCalled();
});
it('sends a short-lived app notification to the child and linked guardian', async () => {
  const result = await service().ring('synthetic', sessionId, student.id);
  expect(result.status).toBe('ringing');
  expect(sendPushNotification).toHaveBeenCalledTimes(2);
  expect(sendPushNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      prefKey: 'classroom.call',
      recipientProfileId: guardian.id,
      call: { id: result.id, expiresAt: result.expiresAt },
    }),
  );
  expect(rpc).toHaveBeenCalledWith(
    'create_classroom_call',
    expect.objectContaining({ _recipient_id: student.id }),
  );
});
it('reports push delivery failure and enforces the database cooldown', async () => {
  jest.mocked(sendPushNotification).mockRejectedValueOnce(new Error('offline'));
  await expect(service().ring('synthetic', sessionId, student.id)).rejects.toThrow(
    'notification could not be sent',
  );
  rpc.mockReturnValue({
    single: jest.fn(async () => ({ data: null, error: { code: 'P0001' } })),
  });
  await expect(service().ring('synthetic', sessionId, student.id)).rejects.toThrow(
    'wait before calling',
  );
});
it('allows a linked guardian to answer only their child’s invitation', async () => {
  rows.classroom_call_invitations = [invite()];
  authId = 'guardian-auth';
  expect(await service().incoming('synthetic')).toHaveLength(1);
  await expect(service().respond('synthetic', id(80), 'accepted')).resolves.toEqual({
    sessionId,
  });
  expect(rows.classroom_call_invitations[0].status).toBe('accepted');
});
it('prevents other accounts from answering and recipients from cancelling the caller’s invitation', async () => {
  rows.classroom_call_invitations = [invite()];
  await expect(service().respond('synthetic', id(80), 'declined')).rejects.toThrow(
    'another participant',
  );
  authId = 'student-auth';
  await expect(service().respond('synthetic', id(80), 'cancelled')).rejects.toThrow(
    'another participant',
  );
});
it('removes calls when expired, already answered, cancelled or the teacher has left', async () => {
  rows.classroom_call_invitations = [
    { ...invite(), expires_at: new Date(Date.now() - 100).toISOString() },
  ];
  authId = 'student-auth';
  expect(await service().incoming('synthetic')).toEqual([]);
  await expect(service().respond('synthetic', id(80), 'accepted')).rejects.toThrow(
    'no longer ringing',
  );
  rows.classroom_call_invitations = [{ ...invite(), status: 'declined' }];
  await expect(service().respond('synthetic', id(80), 'accepted')).rejects.toThrow(
    'no longer ringing',
  );
  rows.classroom_call_invitations = [invite()];
  rows.classroom_call_presence = [];
  expect(await service().incoming('synthetic')).toEqual([]);
});
it('validates presence and refuses credit for another account’s student', async () => {
  expect(() =>
    parseClassroomPresence({ connectionId: 'bad', active: true, profileIds: [] }),
  ).toThrow();
  expect(() =>
    parseClassroomPresence({ connectionId: id(90), active: 'yes', profileIds: [] }),
  ).toThrow();
  await expect(
    service().presence('synthetic', sessionId, id(90), [student.id], true),
  ).rejects.toThrow('identity');
  authId = 'guardian-auth';
  await service().presence('synthetic', sessionId, id(90), [student.id], true);
  expect(rows.classroom_call_presence.some((r) => r.profile_id === student.id)).toBe(
    true,
  );
  await service().presence('synthetic', sessionId, id(90), [student.id], false);
  expect(rows.classroom_call_presence.some((r) => r.profile_id === student.id)).toBe(
    false,
  );
});
it('does not treat a matching display name as identity', () => {
  expect(eligibleClassMember({ ...student, kind: 'staff' }, new Set())).toBe(false);
  expect(
    callView(
      { ...invite(), expires_at: new Date(Date.now() - 1).toISOString() },
      'Class',
      'Teacher',
    ).status,
  ).toBe('expired');
});

it('excludes accidental admins identified only by the account primary role', async () => {
  rows.accounts.find((a) => a.id === guardian.account_id)!.primary_role = 'admin';
  const roster = await service().roster('synthetic', sessionId);
  expect(roster.members.map((p) => p.profileId)).toEqual([teacher.id, student.id]);
});

it('does not interrupt a participant or linked guardian already in another class', async () => {
  rows.classroom_call_presence.push({
    live_session_id: id(51),
    profile_id: student.id,
    last_seen_at: new Date().toISOString(),
  });
  await expect(service().ring('synthetic', sessionId, student.id)).rejects.toThrow(
    'another class',
  );
  rows.classroom_call_invitations = [invite()];
  authId = 'guardian-auth';
  expect(await service().incoming('synthetic')).toEqual([]);
});

it('blocks calls and accepting a pending call outside the scheduled window', async () => {
  jest.mocked(resolveChannelLiveSessionScope).mockResolvedValue({
    schedule: null,
    occurrenceKey: null,
    occurrenceEndAt: null,
  } as never);
  const roster = await service().roster('synthetic', sessionId);
  expect(roster.canCall).toBe(false);
  expect(roster.callingUnavailableReason).toContain('scheduled class time');
  await expect(service().ring('synthetic', sessionId, student.id)).rejects.toThrow(
    'scheduled class time',
  );
  rows.classroom_call_invitations = [invite()];
  authId = 'student-auth';
  expect(await service().incoming('synthetic')).toEqual([]);
  await expect(service().respond('synthetic', id(80), 'accepted')).rejects.toThrow(
    'scheduled class time',
  );
});
it('opens a private tutor conversation as the guardian and declines an active ring', async () => {
  rows.classroom_call_invitations = [invite()];
  authId = 'guardian-auth';
  const result = await service().messageTutor('synthetic', id(80));
  expect(channels.ensureDirectMessageChannel).toHaveBeenCalledWith(
    'synthetic',
    {
      orgId: id(100),
      profileId: guardian.id,
      otherProfileId: teacher.id,
    },
    { classroomCallId: id(80) },
  );
  expect(result).toEqual({
    nativePath: `/(app)/dm/${id(200)}`,
    webPath: `/test-academy/dm/${id(200)}`,
  });
  expect(rows.classroom_call_invitations[0].status).toBe('declined');
});
it('keeps tutor messaging available after class end but disallows joining from a missed call', async () => {
  rows.classroom_call_invitations = [{ ...invite(), status: 'expired' }];
  rows.channel_live_sessions[0].status = 'ended';
  authId = 'student-auth';
  const detail = await service().detail('synthetic', id(80));
  expect(detail).toMatchObject({
    canJoin: false,
    messageAvailable: true,
    status: 'expired',
  });
  await expect(service().joinMissed('synthetic', id(80))).rejects.toThrow(
    'scheduled time',
  );
  await expect(service().messageTutor('synthetic', id(80))).resolves.toMatchObject({
    nativePath: `/(app)/dm/${id(200)}`,
  });
});
it('refuses access to another student’s missed-call details or tutor conversation', async () => {
  rows.classroom_call_invitations = [invite()];
  await expect(service().detail('synthetic', id(80))).rejects.toThrow(
    'another participant',
  );
  await expect(service().messageTutor('synthetic', id(80))).rejects.toThrow(
    'another participant',
  );
  expect(channels.ensureDirectMessageChannel).not.toHaveBeenCalled();
});
