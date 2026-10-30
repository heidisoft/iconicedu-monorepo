import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';
import { toOccurrenceKeyInTimezone } from '@iconicedu/web/lib/admin/learning-space-schedule-hash';

const createSupabaseServerClientMock = vi.fn();
const buildOrgBySlugMock = vi.fn();
const getAccountByAuthUserIdInOrgMock = vi.fn();
const getProfileByAccountIdMock = vi.fn();
const getLearningSpaceDetailMock = vi.fn();
const getClassScheduleSessionContextMock = vi.fn();
const apiPostMock = vi.fn();
const revalidatePathMock = vi.fn();
const enableClassScheduleSeriesRescheduleRunMock = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/api/schedules', () => ({
  getClassScheduleSessionContext: (...args: unknown[]) =>
    getClassScheduleSessionContextMock(...args),
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

vi.mock('@iconicedu/web/flags', () => ({
  enableClassScheduleSeriesReschedule: {
    run: (...args: unknown[]) => enableClassScheduleSeriesRescheduleRunMock(...args),
  },
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

function createSessionContext(
  overrides?: Partial<{
    scheduleId: string;
    title: string;
    startAt: string;
    endAt: string;
    timezone: string | null;
    sourceLearningSpaceId: string | null;
    sourceChannelId: string | null;
  }>,
) {
  return {
    scheduleId: 'schedule-1',
    title: 'Algebra',
    startAt: '2026-03-21T14:00:00.000Z',
    endAt: '2026-03-21T15:00:00.000Z',
    timezone: 'America/New_York',
    sourceLearningSpaceId: 'space-1',
    sourceChannelId: 'channel-1',
    ...overrides,
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
    getClassScheduleSessionContextMock.mockReset();
    buildOrgBySlugMock.mockReset();
    getAccountByAuthUserIdInOrgMock.mockReset();
    getProfileByAccountIdMock.mockReset();
    getLearningSpaceDetailMock.mockReset();
    apiPostMock.mockReset();
    revalidatePathMock.mockReset();
    enableClassScheduleSeriesRescheduleRunMock.mockReset();

    createSupabaseServerClientMock.mockResolvedValue(createServerSupabase());
    getClassScheduleSessionContextMock.mockResolvedValue(createSessionContext());
    buildOrgBySlugMock.mockResolvedValue({ id: 'org-1', slug: 'iconic-academy' });
    getAccountByAuthUserIdInOrgMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'owner' },
    });
    getProfileByAccountIdMock.mockResolvedValue({
      data: { id: 'profile-1' },
    });
    apiPostMock.mockResolvedValue({ success: true, mode: 'recurring' });
    // ON by default in this suite so the existing scope:'all' tests exercise
    // real behavior; the dedicated OFF test below overrides this per-case.
    enableClassScheduleSeriesRescheduleRunMock.mockResolvedValue(true);
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

  it("scope 'all' derives byWeekday from the chosen date and rewrites the whole series", async () => {
    getLearningSpaceDetailMock.mockResolvedValue(
      createLearningSpaceDetail({
        rule: { frequency: 'weekly', timezone: 'America/New_York' },
      }),
    );

    const result = await updateClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T14:00:00.000Z',
      date: '2026-03-24', // a Tuesday
      startTime: '14:00',
      endTime: '15:00',
      timezone: 'America/New_York',
      reason: null,
      scope: 'all',
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      '/schedules/session/reschedule',
      expect.objectContaining({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        scope: 'all',
        byWeekday: ['TU'],
        confirmDropFutureOverrides: false,
      }),
    );
    expect(result).toEqual({
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T14:00:00.000Z',
      mode: 'recurring',
      status: 'scheduled',
      startAt: toOccurrenceKeyInTimezone('2026-03-24', '14:00', 'America/New_York'),
      endAt: toOccurrenceKeyInTimezone('2026-03-24', '15:00', 'America/New_York'),
      timezone: 'America/New_York',
      reason: null,
    });
  });

  it("scope 'all' surfaces a confirmation requirement instead of applying the change", async () => {
    getLearningSpaceDetailMock.mockResolvedValue(
      createLearningSpaceDetail({
        rule: { frequency: 'weekly', timezone: 'America/New_York' },
      }),
    );
    apiPostMock.mockResolvedValue({
      requiresConfirmation: true,
      futureOverrideCount: 2,
      futureExceptionCount: 1,
    });

    const result = await updateClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T14:00:00.000Z',
      date: '2026-03-24',
      startTime: '14:00',
      endTime: '15:00',
      timezone: 'America/New_York',
      scope: 'all',
    });

    expect(result).toEqual({
      requiresConfirmation: true,
      futureOverrideCount: 2,
      futureExceptionCount: 1,
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("scope 'all' rejects a non-recurring schedule", async () => {
    getLearningSpaceDetailMock.mockResolvedValue(
      createLearningSpaceDetail({ rule: undefined }),
    );

    await expect(
      updateClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        date: '2026-03-24',
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'America/New_York',
        scope: 'all',
      }),
    ).rejects.toThrow('Only recurring sessions support editing the whole series.');
  });

  it("scope 'all' rejects the request when enable-class-schedule-series-reschedule is off", async () => {
    enableClassScheduleSeriesRescheduleRunMock.mockResolvedValue(false);
    getLearningSpaceDetailMock.mockResolvedValue(
      createLearningSpaceDetail({
        rule: { frequency: 'weekly', timezone: 'America/New_York' },
      }),
    );

    await expect(
      updateClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        date: '2026-03-24',
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'America/New_York',
        scope: 'all',
      }),
    ).rejects.toThrow('This feature is not available yet.');
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('rejects edits when the API reports the classroom is archived', async () => {
    getClassScheduleSessionContextMock.mockRejectedValue(
      new Error('Archived classrooms cannot be changed.'),
    );

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
    ).rejects.toThrow('Archived classrooms cannot be changed.');
    expect(getLearningSpaceDetailMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('rejects edits when the API reports the schedule was not found', async () => {
    getClassScheduleSessionContextMock.mockRejectedValue(new Error('Schedule not found'));

    await expect(
      updateClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'missing-schedule',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        date: '2026-03-22',
        startTime: '11:30',
        endTime: '12:45',
        timezone: 'America/New_York',
      }),
    ).rejects.toThrow('Schedule not found');
    expect(getLearningSpaceDetailMock).not.toHaveBeenCalled();
  });
});
