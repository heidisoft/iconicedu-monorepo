import { authorizeClassroomCallContact } from './classroom-call-contact';
import { canAccessProfileAsActor } from '@iconicedu/api/lib/actor/resolve-actor-profile';
jest.mock('@iconicedu/api/lib/actor/resolve-actor-profile', () => ({
  canAccessProfileAsActor: jest.fn(),
}));
let data: Record<string, unknown>;
let db: { from: jest.Mock };
beforeEach(() => {
  jest.clearAllMocks();
  data = {
    classroom_call_invitations: {
      caller_profile_id: 'tutor',
      recipient_profile_id: 'student',
      live_session_id: 'meeting',
    },
    profiles: { id: 'student', org_id: 'org', account_id: 'child-account' },
    channel_live_sessions: { channel_id: 'class' },
    channel_members: [{ profile_id: 'tutor' }, { profile_id: 'student' }],
  };
  db = {
    from: jest.fn((table: string) => {
      const result = { data: data[table], error: null };
      const q: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'is']) q[method] = jest.fn(() => q);
      q.maybeSingle = jest.fn(async () => result);
      q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result));
      return q;
    }),
  };
  jest.mocked(canAccessProfileAsActor).mockResolvedValue(true);
});
it('permits a verified recipient or linked guardian to contact only the tutor from that class call', async () => {
  expect(
    await authorizeClassroomCallContact(
      db as never,
      {} as never,
      { orgId: 'org', otherProfileId: 'tutor' },
      'call',
    ),
  ).toBe(true);
  expect(canAccessProfileAsActor).toHaveBeenCalledWith(
    expect.objectContaining({
      orgId: 'org',
      profile: expect.objectContaining({ id: 'student' }),
    }),
  );
});
it('rejects another tutor, an unrelated actor or a missing class', async () => {
  expect(
    await authorizeClassroomCallContact(
      db as never,
      {} as never,
      { orgId: 'org', otherProfileId: 'other-tutor' },
      'call',
    ),
  ).toBe(false);
  jest.mocked(canAccessProfileAsActor).mockResolvedValue(false);
  expect(
    await authorizeClassroomCallContact(
      db as never,
      {} as never,
      { orgId: 'org', otherProfileId: 'tutor' },
      'call',
    ),
  ).toBe(false);
  jest.mocked(canAccessProfileAsActor).mockResolvedValue(true);
  data.channel_live_sessions = null;
  expect(
    await authorizeClassroomCallContact(
      db as never,
      {} as never,
      { orgId: 'org', otherProfileId: 'tutor' },
      'call',
    ),
  ).toBe(false);
});
it('rejects a tutor/student pair without current shared class membership', async () => {
  data.channel_members = [{ profile_id: 'tutor' }];
  expect(
    await authorizeClassroomCallContact(
      db as never,
      {} as never,
      { orgId: 'org', otherProfileId: 'tutor' },
      'call',
    ),
  ).toBe(false);
});
