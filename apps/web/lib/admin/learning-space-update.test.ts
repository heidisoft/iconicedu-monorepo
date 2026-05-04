import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiPostMock } = vi.hoisted(() => ({
  apiPostMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: apiPostMock })),
}));

vi.mock('@iconicedu/web/lib/admin/learning-space-create', async () => {
  const actual = await vi.importActual<
    typeof import('@iconicedu/web/lib/admin/learning-space-create')
  >('@iconicedu/web/lib/admin/learning-space-create');

  return {
    ...actual,
  };
});

import { replaceLearningSpaceSchedules } from '@iconicedu/web/lib/admin/learning-space-update';

describe('replaceLearningSpaceSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPostMock.mockResolvedValue({ scheduleIds: ['schedule-2'] });
  });

  it('delegates schedule replacement to the API', async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: 'token-1' } },
        })),
      },
    };

    await replaceLearningSpaceSchedules(mockSupabase as never, {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      createdBy: 'profile-1',
      createdAt: '2026-03-01T00:00:00.000Z',
      title: 'Algebra',
      description: 'Updated schedule',
      themeKey: 'teal',
      participants: [
        {
          profileId: 'educator-1',
          kind: 'educator',
          displayName: 'Ada Teacher',
          avatarUrl: null,
          themeKey: 'teal',
        },
        {
          profileId: 'child-1',
          kind: 'child',
          displayName: 'Milo Student',
          avatarUrl: null,
          themeKey: 'rose',
        },
        {
          profileId: 'guardian-1',
          kind: 'guardian',
          displayName: 'Gina Guardian',
          avatarUrl: null,
          themeKey: 'pink',
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
          startDate: '2026-03-10T14:00:00.000Z',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['TU'],
            weekdayTimes: [{ day: 'TU', time: '14:00' }],
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
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Algebra',
        participants: [
          expect.objectContaining({ profileId: 'educator-1', kind: 'educator' }),
          expect.objectContaining({ profileId: 'child-1', kind: 'child' }),
          expect.objectContaining({ profileId: 'guardian-1', kind: 'guardian' }),
          expect.objectContaining({ profileId: 'staff-1', kind: 'staff' }),
        ],
      }),
    );
  });
});
