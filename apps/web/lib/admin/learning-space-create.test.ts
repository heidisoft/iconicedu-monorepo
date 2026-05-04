import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  createSupabaseServiceClientMock,
  apiPostMock,
  requireAdminAuthContextMock,
  getAccountByAuthUserIdMock,
  getProfileByAccountIdMock,
  insertClassSchedulesMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  createSupabaseServiceClientMock: vi.fn(),
  apiPostMock: vi.fn(),
  requireAdminAuthContextMock: vi.fn(),
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

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: apiPostMock })),
}));

vi.mock('@iconicedu/web/lib/admin/_auth-context', () => ({
  requireAdminAuthContext: requireAdminAuthContextMock,
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

    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({ error: null })),
      })),
    };
    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue({});
    apiPostMock.mockResolvedValue({ scheduleIds: ['schedule-1'] });
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
      error: null,
    });
    getProfileByAccountIdMock.mockResolvedValue({
      data: { id: 'profile-1' },
      error: null,
    });
    insertClassSchedulesMock.mockResolvedValue(['schedule-1']);
    requireAdminAuthContextMock.mockResolvedValue({
      supabase: serverClient,
      accountId: 'account-1',
      orgId: 'org-1',
      profileId: 'profile-1',
      now: '2026-03-01T00:00:00.000Z',
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
          profileId: 'educator-1',
          kind: 'educator',
          displayName: 'Ada Teacher',
          avatarUrl: null,
          themeKey: 'teal',
        },
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
        {
          profileId: 'staff-1',
          kind: 'staff',
          displayName: 'Sam Staff',
          avatarUrl: null,
          themeKey: 'slate',
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

    expect(apiPostMock).toHaveBeenCalledWith(
      '/schedules/learning-space/replace',
      expect.objectContaining({
        orgId: 'org-1',
        learningSpaceId: expect.any(String),
        participants: [
          expect.objectContaining({ profileId: 'educator-1', kind: 'educator' }),
          expect.objectContaining({ profileId: 'student-1', kind: 'child' }),
          expect.objectContaining({ profileId: 'guardian-1', kind: 'guardian' }),
          expect.objectContaining({ profileId: 'staff-1', kind: 'staff' }),
        ],
      }),
    );
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
