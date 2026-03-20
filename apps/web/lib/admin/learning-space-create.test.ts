import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  createSupabaseServiceClientMock,
  publishActivityEventMock,
  compileLearningSpaceReminderJobsMock,
  ensureSystemProfileIdMock,
  requireParentActorContextMock,
  getAccountByAuthUserIdMock,
  getProfileByAccountIdMock,
  insertClassSchedulesMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  createSupabaseServiceClientMock: vi.fn(),
  publishActivityEventMock: vi.fn(),
  compileLearningSpaceReminderJobsMock: vi.fn(),
  ensureSystemProfileIdMock: vi.fn(),
  requireParentActorContextMock: vi.fn(),
  getAccountByAuthUserIdMock: vi.fn(),
  getProfileByAccountIdMock: vi.fn(),
  insertClassSchedulesMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: publishActivityEventMock,
}));

vi.mock('@iconicedu/web/lib/automation/reminder-jobs', () => ({
  compileLearningSpaceReminderJobs: compileLearningSpaceReminderJobsMock,
}));

vi.mock('@iconicedu/web/lib/automation/system-profile', () => ({
  ensureSystemProfileId: ensureSystemProfileIdMock,
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireParentActorContext: requireParentActorContextMock,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: getAccountByAuthUserIdMock,
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: getProfileByAccountIdMock,
}));

vi.mock('@iconicedu/web/lib/admin/learning-space-create', async () => {
  const actual = await vi.importActual<
    typeof import('@iconicedu/web/lib/admin/learning-space-create')
  >('@iconicedu/web/lib/admin/learning-space-create');

  return {
    ...actual,
    insertClassSchedules: insertClassSchedulesMock,
  };
});

import {
  createLearningSpaceFromPayload,
  publishParticipantInviteActivities,
} from '@iconicedu/web/lib/admin/learning-space-create';

describe('createLearningSpaceFromPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({ error: null })),
      })),
    });
    createSupabaseServiceClientMock.mockReturnValue({});
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
      error: null,
    });
    getProfileByAccountIdMock.mockResolvedValue({
      data: { id: 'profile-1' },
      error: null,
    });
    insertClassSchedulesMock.mockResolvedValue(['schedule-1']);
    ensureSystemProfileIdMock.mockResolvedValue('system-profile-1');
    requireParentActorContextMock.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' },
      source: 'parent',
    });
  });

  it('publishes class creation and one plural participant activity without initial session activity items', async () => {
    await createLearningSpaceFromPayload({
      basics: {
        title: 'Math Foundations',
        kind: 'small_group',
        iconKey: 'book-open',
        subject: 'Math',
        description: 'Weekly math fundamentals',
      },
      settings: {
        themeKey: 'teal',
        uiDefaults: null,
      },
      liveSession: null,
      participants: [
        {
          profileId: 'student-1',
          kind: 'child',
          displayName: 'Tehara Morgan',
          avatarUrl: null,
          themeKey: null,
        },
        {
          profileId: 'guardian-1',
          kind: 'guardian',
          displayName: 'Riley Morgan',
          avatarUrl: null,
          themeKey: 'emerald',
        },
      ],
      resources: [],
      schedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['FR'],
            weekdayTimes: [{ day: 'FR', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    });

    expect(compileLearningSpaceReminderJobsMock).toHaveBeenCalled();
    expect(publishActivityEventMock).toHaveBeenCalledTimes(2);
    expect(publishActivityEventMock.mock.calls.map(([input]) => input.eventType)).toEqual(
      ['class.created', 'members.invited'],
    );
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKind: 'system',
        actorProfileId: 'system-profile-1',
      }),
    );
    expect(publishActivityEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'class.session.scheduled' }),
    );
  });

  it('publishes singular and plural invite events based on participant count', async () => {
    await publishParticipantInviteActivities({
      supabase: {} as never,
      orgId: 'org-1',
      actorProfileId: 'profile-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      participants: [
        {
          profileId: 'student-1',
          kind: 'child',
          displayName: 'Tehara Morgan',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      invitedMembers: [
        {
          profileId: 'student-1',
          name: 'Tehara Morgan',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      occurredAt: '2026-03-01T00:00:00.000Z',
      activityPhase: 'updated',
      dedupeKey: 'member.invited:space-1:student-1',
    });

    await publishParticipantInviteActivities({
      supabase: {} as never,
      orgId: 'org-1',
      actorProfileId: 'profile-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      title: 'Math Foundations',
      participants: [
        {
          profileId: 'student-1',
          kind: 'child',
          displayName: 'Tehara Morgan',
          avatarUrl: null,
          themeKey: null,
        },
        {
          profileId: 'guardian-1',
          kind: 'guardian',
          displayName: 'Riley Morgan',
          avatarUrl: null,
          themeKey: 'emerald',
        },
      ],
      invitedMembers: [
        {
          profileId: 'student-1',
          name: 'Tehara Morgan',
          avatarUrl: null,
          themeKey: null,
        },
        {
          profileId: 'guardian-1',
          name: 'Riley Morgan',
          avatarUrl: null,
          themeKey: 'emerald',
        },
      ],
      occurredAt: '2026-03-01T00:00:00.000Z',
      activityPhase: 'updated',
      dedupeKey: 'members.invited:space-1:batch',
    });

    expect(publishActivityEventMock.mock.calls.map(([input]) => input.eventType)).toEqual(
      ['member.invited', 'members.invited'],
    );
    expect(publishActivityEventMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        eventType: 'members.invited',
        payload: expect.objectContaining({
          memberCount: 2,
          members: [
            expect.objectContaining({ profileId: 'student-1' }),
            expect.objectContaining({ profileId: 'guardian-1' }),
          ],
        }),
      }),
    );
  });
});
