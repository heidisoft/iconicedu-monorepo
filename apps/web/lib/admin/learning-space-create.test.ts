import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  createSupabaseServiceClientMock,
  compileLearningSpaceReminderJobsMock,
  requireParentActorContextMock,
  getAccountByAuthUserIdMock,
  getProfileByAccountIdMock,
  insertClassSchedulesMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  createSupabaseServiceClientMock: vi.fn(),
  compileLearningSpaceReminderJobsMock: vi.fn(),
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

vi.mock('@iconicedu/web/lib/automation/reminder-jobs', () => ({
  compileLearningSpaceReminderJobs: compileLearningSpaceReminderJobsMock,
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

import { createLearningSpaceFromPayload } from '@iconicedu/web/lib/admin/learning-space-create';

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
    requireParentActorContextMock.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' },
      source: 'parent',
    });
  });

  it('creates a learning space and compiles reminder jobs without publishing legacy activities', async () => {
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
      ],
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
  });

  it('supports creating a learning space with multiple participants under the pruned activity model', async () => {
    await expect(
      createLearningSpaceFromPayload({
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
        schedules: [],
      }),
    ).resolves.toBeTruthy();
  });
});
