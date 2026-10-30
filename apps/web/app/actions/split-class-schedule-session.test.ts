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

import { splitClassScheduleSessionAction } from './split-class-schedule-session';

function createServerSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'auth-1' } } })),
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
    startAt: '2026-09-23T13:10:00.000Z',
    endAt: '2026-09-23T14:10:00.000Z',
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
    settings: { themeKey: null, uiDefaults: null },
    liveSession: { enabled: false, provider: 'daily', mode: null, joinUrl: null },
    participants: [],
    schedules: [
      {
        id: 'schedule-1',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        startTime: '09:10',
        endTime: '10:10',
        timezone: 'America/New_York',
        rule: { frequency: 'weekly', timezone: 'America/New_York' },
        exceptions: [],
        overrides: [],
        ...scheduleOverrides,
      },
    ],
  };
}

describe('splitClassScheduleSessionAction', () => {
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
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'staff' },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-1' } });
    getLearningSpaceDetailMock.mockResolvedValue(createLearningSpaceDetail());
    // ON by default in this suite; the dedicated OFF test overrides this.
    enableClassScheduleSeriesRescheduleRunMock.mockResolvedValue(true);
    apiPostMock.mockResolvedValue({
      success: true,
      oldScheduleId: 'schedule-1',
      newScheduleId: 'schedule-2',
    });
  });

  it('derives the new weekday from the date and splits the series via the API', async () => {
    const result = await splitClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-09-23T13:10:00.000Z',
      date: '2026-09-22', // a Tuesday
      startTime: '14:00',
      endTime: '15:00',
      timezone: 'America/New_York',
      reason: 'Parent requested a permanent change',
    });

    expect(apiPostMock).toHaveBeenCalledWith('/schedules/session/split', {
      orgId: 'org-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-09-23T13:10:00.000Z',
      newStartAt: toOccurrenceKeyInTimezone('2026-09-22', '14:00', 'America/New_York'),
      newEndAt: toOccurrenceKeyInTimezone('2026-09-22', '15:00', 'America/New_York'),
      timezone: 'America/New_York',
      byWeekday: ['TU'],
      reason: 'Parent requested a permanent change',
      suppressNotifications: false,
      confirmDropFutureOverrides: false,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/iconic-academy/class-schedule');
    expect(revalidatePathMock).toHaveBeenCalledWith('/iconic-academy/s/channel-1');
    expect(result).toEqual({ oldScheduleId: 'schedule-1', newScheduleId: 'schedule-2' });
  });

  it('surfaces a confirmation requirement instead of revalidating/succeeding', async () => {
    apiPostMock.mockResolvedValue({
      requiresConfirmation: true,
      futureOverrideCount: 1,
      futureExceptionCount: 2,
    });

    const result = await splitClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-09-23T13:10:00.000Z',
      date: '2026-09-22',
      startTime: '14:00',
      endTime: '15:00',
      timezone: 'America/New_York',
    });

    expect(result).toEqual({
      requiresConfirmation: true,
      futureOverrideCount: 1,
      futureExceptionCount: 2,
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('rejects a schedule that is not part of a recurring series', async () => {
    getLearningSpaceDetailMock.mockResolvedValue(
      createLearningSpaceDetail({ rule: undefined }),
    );

    await expect(
      splitClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-09-23T13:10:00.000Z',
        date: '2026-09-22',
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'America/New_York',
      }),
    ).rejects.toThrow('This session is not part of a recurring series.');
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('rejects non-staff non-owner profiles', async () => {
    getAccountByAuthUserIdInOrgMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'guardian' },
    });

    await expect(
      splitClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-09-23T13:10:00.000Z',
        date: '2026-09-22',
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'America/New_York',
      }),
    ).rejects.toThrow('Only staff or owner users can edit sessions.');
  });

  it('rejects the request when enable-class-schedule-series-reschedule is off', async () => {
    enableClassScheduleSeriesRescheduleRunMock.mockResolvedValue(false);

    await expect(
      splitClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-09-23T13:10:00.000Z',
        date: '2026-09-22',
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'America/New_York',
      }),
    ).rejects.toThrow('This feature is not available yet.');
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('rejects edits when the API reports the classroom is archived', async () => {
    getClassScheduleSessionContextMock.mockRejectedValue(
      new Error('Archived classrooms cannot be changed.'),
    );

    await expect(
      splitClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-09-23T13:10:00.000Z',
        date: '2026-09-22',
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'America/New_York',
      }),
    ).rejects.toThrow('Archived classrooms cannot be changed.');
    expect(getLearningSpaceDetailMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('rejects edits when the API reports the schedule was not found', async () => {
    getClassScheduleSessionContextMock.mockRejectedValue(new Error('Schedule not found'));

    await expect(
      splitClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'missing-schedule',
        occurrenceKey: '2026-09-23T13:10:00.000Z',
        date: '2026-09-22',
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'America/New_York',
      }),
    ).rejects.toThrow('Schedule not found');
    expect(getLearningSpaceDetailMock).not.toHaveBeenCalled();
  });
});
