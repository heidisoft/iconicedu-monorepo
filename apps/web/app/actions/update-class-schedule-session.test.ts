import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';
import { toOccurrenceKeyInTimezone } from '@iconicedu/web/lib/admin/learning-space-schedule-hash';

const createSupabaseServerClientMock = vi.fn();
const createSupabaseServiceClientMock = vi.fn();
const buildOrgBySlugMock = vi.fn();
const getAccountByAuthUserIdInOrgMock = vi.fn();
const getProfileByAccountIdMock = vi.fn();
const getLearningSpaceDetailMock = vi.fn();
const apiPostMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: (...args: unknown[]) =>
    createSupabaseServiceClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlugMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserIdInOrg: (...args: unknown[]) =>
    getAccountByAuthUserIdInOrgMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: (...args: unknown[]) => getProfileByAccountIdMock(...args),
}));

vi.mock('@iconicedu/web/lib/admin/learning-space-detail', async () => {
  const actual = await vi.importActual<
    typeof import('@iconicedu/web/lib/admin/learning-space-detail')
  >('@iconicedu/web/lib/admin/learning-space-detail');

  return {
    ...actual,
    getLearningSpaceDetail: (...args: unknown[]) => getLearningSpaceDetailMock(...args),
  };
});

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: apiPostMock })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { updateClassScheduleSessionAction } from './update-class-schedule-session';

function createServerSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: 'auth-1' },
        },
      })),
    },
  };
}

function createServiceSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'class_schedules') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: 'schedule-1',
                      org_id: 'org-1',
                      source_learning_space_id: 'space-1',
                      source_channel_id: 'channel-1',
                      timezone: 'America/New_York',
                      title: 'Algebra',
                      start_at: '2026-03-21T14:00:00.000Z',
                      end_at: '2026-03-21T15:00:00.000Z',
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'learning_spaces') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { status: 'active', archived_at: null },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createLearningSpaceDetail(
  scheduleOverrides?: Partial<LearningSpaceDetail['schedules'][number]>,
): LearningSpaceDetail {
  return {
    ids: { id: 'space-1', orgId: 'org-1' },
    basics: {
      kind: 'classroom',
      title: 'Algebra',
      iconKey: null,
      subject: null,
      description: null,
    },
    settings: {
      themeKey: null,
      uiDefaults: null,
    },
    liveSession: {
      enabled: false,
      provider: 'daily',
      mode: null,
      joinUrl: null,
    },
    participants: [
      {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-child-1' },
        profile: {
          displayName: 'Ada',
          avatar: { url: null },
        },
        prefs: { timezone: 'America/New_York' },
        meta: {},
        ui: { themeKey: 'blue' },
      } satisfies LearningSpaceDetail['participants'][number],
    ],
    schedules: [
      {
        id: 'schedule-1',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        timezone: 'America/New_York',
        rule: undefined,
        exceptions: [],
        overrides: [],
        ...scheduleOverrides,
      },
    ],
  };
}

describe('updateClassScheduleSessionAction', () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    createSupabaseServiceClientMock.mockReset();
    buildOrgBySlugMock.mockReset();
    getAccountByAuthUserIdInOrgMock.mockReset();
    getProfileByAccountIdMock.mockReset();
    getLearningSpaceDetailMock.mockReset();
    apiPostMock.mockReset();
    revalidatePathMock.mockReset();

    createSupabaseServerClientMock.mockResolvedValue(createServerSupabase());
    createSupabaseServiceClientMock.mockReturnValue(createServiceSupabase());
    buildOrgBySlugMock.mockResolvedValue({ id: 'org-1', slug: 'iconic-academy' });
    getAccountByAuthUserIdInOrgMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'owner' },
    });
    getProfileByAccountIdMock.mockResolvedValue({
      data: { id: 'profile-1' },
    });
    apiPostMock.mockResolvedValue({ success: true, mode: 'recurring' });
  });

  it('delegates recurring reschedules to the API without rewriting exceptions', async () => {
    getLearningSpaceDetailMock.mockResolvedValue(
      createLearningSpaceDetail({
        rule: { frequency: 'weekly', timezone: 'America/New_York' },
        exceptions: [{ id: 'exception-1', date: '2026-03-14', reason: 'Holiday' }],
        overrides: [
          {
            id: 'override-1',
            originalDate: '2026-03-21',
            newDate: '2026-03-21',
            newTime: '12:00',
            newEndTime: '13:00',
            reason: 'Old change',
          },
        ],
      }),
    );

    const result = await updateClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T14:00:00.000Z',
      date: '2026-03-22',
      startTime: '11:30',
      endTime: '12:45',
      timezone: 'America/Chicago',
      reason: ' Family requested a change ',
    });

    expect(apiPostMock).toHaveBeenCalledWith('/schedules/session/reschedule', {
      orgId: 'org-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T14:00:00.000Z',
      startAt: toOccurrenceKeyInTimezone('2026-03-22', '11:30', 'America/New_York'),
      endAt: toOccurrenceKeyInTimezone('2026-03-22', '12:45', 'America/New_York'),
      timezone: 'America/New_York',
      reason: 'Family requested a change',
      suppressNotifications: false,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/iconic-academy/class-schedule');
    expect(revalidatePathMock).toHaveBeenCalledWith('/iconic-academy/s/channel-1');
    expect(result).toEqual({
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T14:00:00.000Z',
      mode: 'recurring',
      status: 'rescheduled',
      startAt: toOccurrenceKeyInTimezone('2026-03-22', '11:30', 'America/New_York'),
      endAt: toOccurrenceKeyInTimezone('2026-03-22', '12:45', 'America/New_York'),
      timezone: 'America/New_York',
      reason: 'Family requested a change',
    });
  });

  it('delegates single-session schedule edits to the API', async () => {
    getLearningSpaceDetailMock.mockResolvedValue(
      createLearningSpaceDetail({
        startDate: new Date('2026-03-21T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        timezone: 'UTC',
      }),
    );

    const result = await updateClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      date: '2026-03-23',
      startTime: '09:15',
      endTime: '10:00',
      timezone: 'America/Chicago',
      reason: null,
    });

    expect(apiPostMock).toHaveBeenCalledWith('/schedules/session/reschedule', {
      orgId: 'org-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      startAt: toOccurrenceKeyInTimezone('2026-03-23', '09:15', 'America/Chicago'),
      endAt: toOccurrenceKeyInTimezone('2026-03-23', '10:00', 'America/Chicago'),
      timezone: 'America/Chicago',
      reason: null,
      suppressNotifications: false,
    });
    expect(result).toEqual({
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      mode: 'single',
      status: 'scheduled',
      startAt: toOccurrenceKeyInTimezone('2026-03-23', '09:15', 'America/Chicago'),
      endAt: toOccurrenceKeyInTimezone('2026-03-23', '10:00', 'America/Chicago'),
      timezone: 'America/Chicago',
      reason: null,
    });
  });

  it('rejects non-staff non-owner profiles', async () => {
    getAccountByAuthUserIdInOrgMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'guardian' },
    });

    await expect(
      updateClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        date: '2026-03-22',
        startTime: '11:30',
        endTime: '12:45',
        timezone: 'America/New_York',
      }),
    ).rejects.toThrow('Only staff or owner users can edit sessions.');
  });

  it('passes silent reschedule intent to the API', async () => {
    getLearningSpaceDetailMock.mockResolvedValue(
      createLearningSpaceDetail({
        rule: { frequency: 'weekly', timezone: 'America/New_York' },
      }),
    );

    await updateClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T14:00:00.000Z',
      date: '2026-03-22',
      startTime: '11:30',
      endTime: '12:45',
      timezone: 'America/Chicago',
      suppressNotifications: true,
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      '/schedules/session/reschedule',
      expect.objectContaining({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        suppressNotifications: true,
      }),
    );
  });
});
