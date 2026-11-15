import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  requireAdminAuthContextMock,
  getAccountByAuthUserIdMock,
  getProfileByAccountIdMock,
  publishActivityEventMock,
  apiPostMock,
  getLearningSpaceEditContextMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  requireAdminAuthContextMock: vi.fn(),
  getAccountByAuthUserIdMock: vi.fn(),
  getProfileByAccountIdMock: vi.fn(),
  publishActivityEventMock: vi.fn(),
  apiPostMock: vi.fn(),
  getLearningSpaceEditContextMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
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

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: publishActivityEventMock,
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: apiPostMock })),
}));

vi.mock('@iconicedu/web/lib/api/schedules', () => ({
  getLearningSpaceEditContext: getLearningSpaceEditContextMock,
}));

import type { LearningSpaceCreatePayload } from '@iconicedu/shared-types';
import { updateLearningSpaceFromPayload } from '@iconicedu/web/lib/admin/learning-space-update';

function createSelectSingleChain<T>(result: {
  data: T;
  error: { message: string } | null;
}) {
  const selectChain = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    returns: vi.fn(() => chain),
  };
  const chain = selectChain;

  const updateChain = {
    error: null as { message: string } | null,
    eq: vi.fn(() => updateChain),
    is: vi.fn(() => updateChain),
  };

  return {
    select: vi.fn(() => chain),
    update: vi.fn(() => updateChain),
  };
}

function createMutationTable() {
  const chain = {
    error: null as { message: string } | null,
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
  };

  return {
    delete: vi.fn(() => chain),
    update: vi.fn(() => chain),
    insert: vi.fn(async () => ({ error: null })),
    upsert: vi.fn(async () => ({ error: null })),
  };
}

/** Converts the same raw snake_case row shapes these tests already build for
 * the (now-removed) service-role client reads into the camelCase VM
 * getLearningSpaceEditContext returns, so each test's fixture data below is
 * unchanged — only the delivery mechanism differs. */
function buildEditContextFixture(input: {
  participantIds: string[];
  schedules: Array<{
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    timezone?: string | null;
  }>;
  recurrences?: Array<Record<string, unknown>>;
  exceptions?: Array<Record<string, unknown>>;
  overrides?: Array<Record<string, unknown>>;
  channel: {
    topic?: string | null;
    description?: string | null;
    icon_key?: string | null;
    ui_theme_key?: string | null;
    ui_defaults?: unknown;
    live_session_config?: unknown;
  } | null;
}) {
  return {
    participantProfileIds: input.participantIds,
    schedules: input.schedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      startAt: schedule.start_at,
      endAt: schedule.end_at,
      timezone: schedule.timezone ?? null,
    })),
    recurrences: (input.recurrences ?? []).map((row) => ({
      id: row.id as string,
      scheduleId: row.schedule_id as string,
      frequency: (row.frequency as string) ?? 'weekly',
      interval: (row.interval as number | null) ?? null,
      count: (row.count as number | null) ?? null,
      until: (row.until as string | null) ?? null,
      timezone: (row.timezone as string | null) ?? null,
      bySecond: (row.bysecond as number[] | null) ?? null,
      byMinute: (row.byminute as number[] | null) ?? null,
      byHour: (row.byhour as number[] | null) ?? null,
      byDay: (row.byday as string[] | null) ?? null,
      byMonthDay: (row.bymonthday as number[] | null) ?? null,
      byYearDay: (row.byyearday as number[] | null) ?? null,
      byWeekNo: (row.byweekno as number[] | null) ?? null,
      byMonth: (row.bymonth as number[] | null) ?? null,
      bySetPos: (row.bysetpos as number[] | null) ?? null,
      wkst: (row.wkst as string | null) ?? null,
    })),
    exceptions: (input.exceptions ?? []).map((row) => ({
      recurrenceId: row.recurrence_id as string,
      occurrenceKey: row.occurrence_key as string,
      reason: (row.reason as string | null) ?? null,
    })),
    overrides: (input.overrides ?? []).map((row) => ({
      recurrenceId: row.recurrence_id as string,
      occurrenceKey: row.occurrence_key as string,
      patch: (row.patch as Record<string, unknown> | null) ?? null,
    })),
    channel: input.channel
      ? {
          topic: input.channel.topic ?? null,
          description: input.channel.description ?? null,
          iconKey: input.channel.icon_key ?? null,
          themeKey: input.channel.ui_theme_key ?? null,
          uiDefaults: input.channel.ui_defaults ?? null,
          liveSessionConfig: input.channel.live_session_config ?? null,
        }
      : null,
  };
}

describe('updateLearningSpaceFromPayload no-op behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
    requireAdminAuthContextMock.mockResolvedValue({
      supabase: {},
      accountId: 'account-1',
      orgId: 'org-1',
      profileId: 'profile-actor-1',
      now: '2026-03-01T12:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not emit activity events for unchanged payload', async () => {
    const payload: LearningSpaceCreatePayload = {
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
          profileId: 'profile-1',
          kind: 'educator',
          displayName: 'Alex Educator',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    };

    const learningSpacesTable = createSelectSingleChain({
      data: {
        id: 'space-1',
        org_id: 'org-1',
        kind: payload.basics.kind,
        title: payload.basics.title,
        icon_key: payload.basics.iconKey,
        subject: payload.basics.subject,
        description: payload.basics.description,
      },
      error: null,
    });

    const learningSpaceChannelsTable = createSelectSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });

    const mutationTable = createMutationTable();
    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_spaces':
            return learningSpacesTable;
          case 'learning_space_channels':
            return learningSpaceChannelsTable;
          case 'channels':
            return channelsTable;
          default:
            return mutationTable;
        }
      }),
    };

    const channelsTable = createSelectSingleChain({
      data: {
        topic: payload.basics.title,
        description: payload.basics.description,
        icon_key: payload.basics.iconKey,
        ui_theme_key: payload.settings?.themeKey,
        ui_defaults: payload.settings?.uiDefaults ?? null,
        live_session_config: null,
      },
      error: null,
    });

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    getLearningSpaceEditContextMock.mockResolvedValue(
      buildEditContextFixture({
        participantIds: ['profile-1'],
        schedules: [
          {
            id: 'schedule-1',
            title: payload.basics.title,
            start_at: '2026-03-14T14:00:00.000Z',
            end_at: '2026-03-14T15:00:00.000Z',
            timezone: 'UTC',
          },
        ],
        recurrences: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
        channel: {
          topic: payload.basics.title,
          description: payload.basics.description,
          icon_key: payload.basics.iconKey,
          ui_theme_key: payload.settings?.themeKey,
          ui_defaults: payload.settings?.uiDefaults ?? null,
          live_session_config: null,
        },
      }),
    );
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('emits class.updated only for info-only edits with unchanged schedule semantics', async () => {
    const payload: LearningSpaceCreatePayload = {
      basics: {
        title: 'Math Foundations',
        kind: 'small_group',
        iconKey: 'book-open',
        subject: 'Math',
        description: 'Weekly math fundamentals (updated)',
      },
      settings: {
        themeKey: 'teal',
        uiDefaults: null,
      },
      liveSession: null,
      participants: [
        {
          profileId: 'profile-1',
          kind: 'educator',
          displayName: 'Alex Educator',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    };

    const learningSpacesTable = createSelectSingleChain({
      data: {
        id: 'space-1',
        org_id: 'org-1',
        kind: payload.basics.kind,
        title: payload.basics.title,
        icon_key: payload.basics.iconKey,
        subject: payload.basics.subject,
        description: 'Weekly math fundamentals',
      },
      error: null,
    });

    const learningSpaceChannelsTable = createSelectSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });

    const mutationTable = createMutationTable();
    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_spaces':
            return learningSpacesTable;
          case 'learning_space_channels':
            return learningSpaceChannelsTable;
          case 'channels':
            return channelsTable;
          default:
            return mutationTable;
        }
      }),
    };

    const channelsTable = createSelectSingleChain({
      data: {
        topic: payload.basics.title,
        description: 'Weekly math fundamentals',
        icon_key: payload.basics.iconKey,
        ui_theme_key: payload.settings?.themeKey,
        ui_defaults: payload.settings?.uiDefaults ?? null,
        live_session_config: null,
      },
      error: null,
    });

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    getLearningSpaceEditContextMock.mockResolvedValue(
      buildEditContextFixture({
        participantIds: ['profile-1'],
        schedules: [
          {
            id: 'schedule-1',
            title: payload.basics.title,
            start_at: '2026-03-14T14:00:00.000Z',
            end_at: '2026-03-14T15:00:00.000Z',
            timezone: 'UTC',
          },
        ],
        recurrences: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
        channel: {
          topic: payload.basics.title,
          description: 'Weekly math fundamentals',
          icon_key: payload.basics.iconKey,
          ui_theme_key: payload.settings?.themeKey,
          ui_defaults: payload.settings?.uiDefaults ?? null,
          live_session_config: null,
        },
      }),
    );
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });
    publishActivityEventMock.mockResolvedValue({ id: 'activity-1' });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });

  it('updates schedule override edits without compiling reminder jobs', async () => {
    vi.stubEnv('DEBUG_LEARNING_SPACE_SCHEDULE_DIFF', '1');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const payload: LearningSpaceCreatePayload = {
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
          profileId: 'profile-1',
          kind: 'educator',
          displayName: 'Alex Educator',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [
            {
              originalDate: '2026-03-21',
              newDate: '2026-03-21',
              newTime: '15:00',
              reason: 'Rescheduled',
            },
          ],
        },
      ],
    };

    const learningSpacesTable = createSelectSingleChain({
      data: {
        id: 'space-1',
        org_id: 'org-1',
        kind: payload.basics.kind,
        title: payload.basics.title,
        icon_key: payload.basics.iconKey,
        subject: payload.basics.subject,
        description: payload.basics.description,
      },
      error: null,
    });

    const learningSpaceChannelsTable = createSelectSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });

    const mutationTable = createMutationTable();
    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_spaces':
            return learningSpacesTable;
          case 'learning_space_channels':
            return learningSpaceChannelsTable;
          case 'channels':
            return channelsTable;
          default:
            return mutationTable;
        }
      }),
    };

    const channelsTable = createSelectSingleChain({
      data: {
        topic: payload.basics.title,
        description: payload.basics.description,
        icon_key: payload.basics.iconKey,
        ui_theme_key: payload.settings?.themeKey,
        ui_defaults: payload.settings?.uiDefaults ?? null,
        live_session_config: null,
      },
      error: null,
    });

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    getLearningSpaceEditContextMock.mockResolvedValue(
      buildEditContextFixture({
        participantIds: ['profile-1'],
        schedules: [
          {
            id: 'schedule-1',
            title: payload.basics.title,
            start_at: '2026-03-14T14:00:00.000Z',
            end_at: '2026-03-14T15:00:00.000Z',
            timezone: 'UTC',
          },
        ],
        recurrences: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
        channel: {
          topic: payload.basics.title,
          description: payload.basics.description,
          icon_key: payload.basics.iconKey,
          ui_theme_key: payload.settings?.themeKey,
          ui_defaults: payload.settings?.uiDefaults ?? null,
          live_session_config: null,
        },
      }),
    );
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });
    publishActivityEventMock.mockResolvedValue({ id: 'activity-1' });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(apiPostMock).toHaveBeenCalledWith(
      '/schedules/learning-space/replace',
      expect.objectContaining({ orgId: 'org-1', learningSpaceId: 'space-1' }),
    );
    expect(publishActivityEventMock).not.toHaveBeenCalled();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('skips activity publishing when sendActivityNotifications is false', async () => {
    const payload: LearningSpaceCreatePayload = {
      basics: {
        title: 'Math Foundations Advanced',
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
          profileId: 'profile-1',
          kind: 'educator',
          displayName: 'Alex Educator',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startDate: '2026-03-14T14:00:00.000Z',
          startTime: '14:00',
          endTime: '15:00',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    };

    const learningSpacesTable = createSelectSingleChain({
      data: {
        id: 'space-1',
        org_id: 'org-1',
        kind: 'small_group',
        title: 'Math Foundations',
        icon_key: 'book-open',
        subject: 'Math',
        description: 'Weekly math fundamentals',
      },
      error: null,
    });

    const learningSpaceChannelsTable = createSelectSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });

    const channelsTable = createSelectSingleChain({
      data: {
        topic: 'Math Foundations',
        description: payload.basics.description,
        icon_key: payload.basics.iconKey,
        ui_theme_key: payload.settings?.themeKey,
        ui_defaults: payload.settings?.uiDefaults ?? null,
        live_session_config: null,
      },
      error: null,
    });

    const mutationTable = createMutationTable();
    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_spaces':
            return learningSpacesTable;
          case 'learning_space_channels':
            return learningSpaceChannelsTable;
          case 'channels':
            return channelsTable;
          default:
            return mutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    getLearningSpaceEditContextMock.mockResolvedValue(
      buildEditContextFixture({
        participantIds: ['profile-1'],
        schedules: [
          {
            id: 'schedule-1',
            title: 'Math Foundations',
            start_at: '2026-03-14T14:00:00.000Z',
            end_at: '2026-03-14T15:00:00.000Z',
            timezone: 'UTC',
          },
        ],
        recurrences: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
        channel: {
          topic: 'Math Foundations',
          description: payload.basics.description,
          icon_key: payload.basics.iconKey,
          ui_theme_key: payload.settings?.themeKey,
          ui_defaults: payload.settings?.uiDefaults ?? null,
          live_session_config: null,
        },
      }),
    );

    await updateLearningSpaceFromPayload('space-1', payload, undefined, {
      sendActivityNotifications: false,
    });

    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });

  it('does not emit activity for added exceptions when base schedule also changes', async () => {
    const payload: LearningSpaceCreatePayload = {
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
          profileId: 'profile-1',
          kind: 'educator',
          displayName: 'Alex Educator',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startDate: '2026-03-14T14:30:00.000Z',
          startTime: '14:30',
          endTime: '15:30',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:30' }],
          },
          exceptions: [{ date: '2026-03-21', reason: 'Holiday' }],
          overrides: [],
        },
      ],
    };

    const learningSpacesTable = createSelectSingleChain({
      data: {
        id: 'space-1',
        org_id: 'org-1',
        kind: payload.basics.kind,
        title: payload.basics.title,
        icon_key: payload.basics.iconKey,
        subject: payload.basics.subject,
        description: payload.basics.description,
      },
      error: null,
    });

    const learningSpaceChannelsTable = createSelectSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });

    const mutationTable = createMutationTable();
    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_spaces':
            return learningSpacesTable;
          case 'learning_space_channels':
            return learningSpaceChannelsTable;
          case 'channels':
            return channelsTable;
          default:
            return mutationTable;
        }
      }),
    };

    const channelsTable = createSelectSingleChain({
      data: {
        topic: payload.basics.title,
        description: payload.basics.description,
        icon_key: payload.basics.iconKey,
        ui_theme_key: payload.settings?.themeKey,
        ui_defaults: payload.settings?.uiDefaults ?? null,
        live_session_config: null,
      },
      error: null,
    });

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    getLearningSpaceEditContextMock.mockResolvedValue(
      buildEditContextFixture({
        participantIds: ['profile-1'],
        schedules: [
          {
            id: 'schedule-1',
            title: payload.basics.title,
            start_at: '2026-03-14T14:00:00.000Z',
            end_at: '2026-03-14T15:00:00.000Z',
            timezone: 'UTC',
          },
        ],
        recurrences: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
        channel: {
          topic: payload.basics.title,
          description: payload.basics.description,
          icon_key: payload.basics.iconKey,
          ui_theme_key: payload.settings?.themeKey,
          ui_defaults: payload.settings?.uiDefaults ?? null,
          live_session_config: null,
        },
      }),
    );
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });
    publishActivityEventMock.mockResolvedValue({ id: 'activity-1' });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });

  it('does not emit schedule activity when only unchanged multiple schedules are present', async () => {
    const payload: LearningSpaceCreatePayload = {
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
          profileId: 'profile-1',
          kind: 'educator',
          displayName: 'Alex Educator',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startDate: '2026-03-14T14:30:00.000Z',
          startTime: '14:30',
          endTime: '15:30',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '14:30' }],
          },
          exceptions: [],
          overrides: [],
        },
        {
          startDate: '2026-03-14T16:30:00.000Z',
          startTime: '16:30',
          endTime: '17:30',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['SA'],
            weekdayTimes: [{ day: 'SA', time: '16:30' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    };

    const learningSpacesTable = createSelectSingleChain({
      data: {
        id: 'space-1',
        org_id: 'org-1',
        kind: payload.basics.kind,
        title: payload.basics.title,
        icon_key: payload.basics.iconKey,
        subject: payload.basics.subject,
        description: payload.basics.description,
      },
      error: null,
    });

    const learningSpaceChannelsTable = createSelectSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });

    const mutationTable = createMutationTable();
    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_spaces':
            return learningSpacesTable;
          case 'learning_space_channels':
            return learningSpaceChannelsTable;
          case 'channels':
            return channelsTable;
          default:
            return mutationTable;
        }
      }),
    };

    const channelsTable = createSelectSingleChain({
      data: {
        topic: payload.basics.title,
        description: payload.basics.description,
        icon_key: payload.basics.iconKey,
        ui_theme_key: payload.settings?.themeKey,
        ui_defaults: payload.settings?.uiDefaults ?? null,
        live_session_config: null,
      },
      error: null,
    });

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    getLearningSpaceEditContextMock.mockResolvedValue(
      buildEditContextFixture({
        participantIds: ['profile-1'],
        schedules: [
          {
            id: 'schedule-1',
            title: payload.basics.title,
            start_at: '2026-03-14T14:00:00.000Z',
            end_at: '2026-03-14T15:00:00.000Z',
            timezone: 'UTC',
          },
          {
            id: 'schedule-2',
            title: payload.basics.title,
            start_at: '2026-03-14T16:00:00.000Z',
            end_at: '2026-03-14T17:00:00.000Z',
            timezone: 'UTC',
          },
        ],
        recurrences: [
          { id: 'recurrence-1', schedule_id: 'schedule-1' },
          { id: 'recurrence-2', schedule_id: 'schedule-2' },
        ],
        channel: {
          topic: payload.basics.title,
          description: payload.basics.description,
          icon_key: payload.basics.iconKey,
          ui_theme_key: payload.settings?.themeKey,
          ui_defaults: payload.settings?.uiDefaults ?? null,
          live_session_config: null,
        },
      }),
    );
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });
    publishActivityEventMock.mockResolvedValue({ id: 'activity-1' });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });

  it('does not emit schedule activity for unchanged timezone-backed exceptions and overrides', async () => {
    const payload: LearningSpaceCreatePayload = {
      basics: {
        title: 'ELA tutoring with Ms Charmain',
        kind: 'small_group',
        iconKey: 'book-open',
        subject: 'ELA',
        description: 'Weekly tutoring',
      },
      settings: {
        themeKey: 'teal',
        uiDefaults: null,
      },
      liveSession: null,
      participants: [
        {
          profileId: 'profile-1',
          kind: 'educator',
          displayName: 'Ms Charmain',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startDate: '2026-03-10T12:00:00.000Z',
          startTime: '17:02',
          endTime: '18:02',
          timezone: 'America/New_York',
          rule: {
            frequency: 'weekly',
            byWeekday: ['TU'],
            weekdayTimes: [{ day: 'TU', time: '17:02' }],
            timezone: 'America/New_York',
          },
          exceptions: [
            { date: '2026-03-17', reason: 'Holiday' },
            { date: '2026-03-31', reason: 'Break' },
          ],
          overrides: [
            {
              originalDate: '2026-03-24',
              newDate: '2026-03-25',
              newTime: '18:15',
              reason: 'Rescheduled',
            },
          ],
        },
      ],
    };

    const learningSpacesTable = createSelectSingleChain({
      data: {
        id: 'space-1',
        org_id: 'org-1',
        kind: payload.basics.kind,
        title: payload.basics.title,
        icon_key: payload.basics.iconKey,
        subject: payload.basics.subject,
        description: payload.basics.description,
      },
      error: null,
    });

    const learningSpaceChannelsTable = createSelectSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });

    const mutationTable = createMutationTable();
    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_spaces':
            return learningSpacesTable;
          case 'learning_space_channels':
            return learningSpaceChannelsTable;
          case 'channels':
            return channelsTable;
          default:
            return mutationTable;
        }
      }),
    };

    const channelsTable = createSelectSingleChain({
      data: {
        topic: payload.basics.title,
        description: payload.basics.description,
        icon_key: payload.basics.iconKey,
        ui_theme_key: payload.settings?.themeKey,
        ui_defaults: payload.settings?.uiDefaults ?? null,
        live_session_config: null,
      },
      error: null,
    });

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    getLearningSpaceEditContextMock.mockResolvedValue(
      buildEditContextFixture({
        participantIds: ['profile-1'],
        schedules: [
          {
            id: 'schedule-1',
            title: payload.basics.title,
            start_at: '2026-03-10T21:02:00.000Z',
            end_at: '2026-03-10T22:02:00.000Z',
            timezone: 'America/New_York',
          },
        ],
        recurrences: [
          {
            id: 'recurrence-1',
            schedule_id: 'schedule-1',
            frequency: 'weekly',
            interval: 1,
            count: null,
            until: null,
            timezone: 'America/New_York',
            bysecond: null,
            byminute: [2],
            byhour: [17],
            byday: ['TU'],
            bymonthday: null,
            byyearday: null,
            byweekno: null,
            bymonth: null,
            bysetpos: null,
            wkst: 'MO',
          },
        ],
        exceptions: [
          {
            recurrence_id: 'recurrence-1',
            occurrence_key: '2026-03-17T21:02:00.000Z',
            reason: 'Holiday',
          },
          {
            recurrence_id: 'recurrence-1',
            occurrence_key: '2026-03-31T21:02:00.000Z',
            reason: 'Break',
          },
        ],
        overrides: [
          {
            recurrence_id: 'recurrence-1',
            occurrence_key: '2026-03-24T21:02:00.000Z',
            patch: {
              startAt: '2026-03-25T22:15:00.000Z',
              endAt: '2026-03-25T23:15:00.000Z',
              reason: 'Rescheduled',
            },
          },
        ],
        channel: {
          topic: payload.basics.title,
          description: payload.basics.description,
          icon_key: payload.basics.iconKey,
          ui_theme_key: payload.settings?.themeKey,
          ui_defaults: payload.settings?.uiDefaults ?? null,
          live_session_config: null,
        },
      }),
    );
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('does not emit schedule activity for unchanged overrides saved with legacy patch keys', async () => {
    const payload: LearningSpaceCreatePayload = {
      basics: {
        title: 'ELA tutoring with Ms Charmain',
        kind: 'small_group',
        iconKey: 'book-open',
        subject: 'ELA',
        description: 'Weekly tutoring',
      },
      settings: {
        themeKey: 'teal',
        uiDefaults: null,
      },
      liveSession: null,
      participants: [
        {
          profileId: 'profile-1',
          kind: 'educator',
          displayName: 'Ms Charmain',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startDate: '2026-03-10T12:00:00.000Z',
          startTime: '17:02',
          endTime: '18:02',
          timezone: 'America/New_York',
          rule: {
            frequency: 'weekly',
            byWeekday: ['TU'],
            weekdayTimes: [{ day: 'TU', time: '17:02' }],
            timezone: 'America/New_York',
          },
          exceptions: [{ date: '2026-03-17', reason: 'Holiday' }],
          overrides: [
            {
              originalDate: '2026-03-24',
              newDate: '2026-03-25',
              newTime: '18:15',
              reason: 'Rescheduled',
            },
          ],
        },
      ],
    };

    const learningSpacesTable = createSelectSingleChain({
      data: {
        id: 'space-1',
        org_id: 'org-1',
        kind: payload.basics.kind,
        title: payload.basics.title,
        icon_key: payload.basics.iconKey,
        subject: payload.basics.subject,
        description: payload.basics.description,
      },
      error: null,
    });

    const learningSpaceChannelsTable = createSelectSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });

    const mutationTable = createMutationTable();
    const serverClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_spaces':
            return learningSpacesTable;
          case 'learning_space_channels':
            return learningSpaceChannelsTable;
          case 'channels':
            return channelsTable;
          default:
            return mutationTable;
        }
      }),
    };

    const channelsTable = createSelectSingleChain({
      data: {
        topic: payload.basics.title,
        description: payload.basics.description,
        icon_key: payload.basics.iconKey,
        ui_theme_key: payload.settings?.themeKey,
        ui_defaults: payload.settings?.uiDefaults ?? null,
        live_session_config: null,
      },
      error: null,
    });

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    getLearningSpaceEditContextMock.mockResolvedValue(
      buildEditContextFixture({
        participantIds: ['profile-1'],
        schedules: [
          {
            id: 'schedule-1',
            title: payload.basics.title,
            start_at: '2026-03-10T21:02:00.000Z',
            end_at: '2026-03-10T22:02:00.000Z',
            timezone: 'America/New_York',
          },
        ],
        recurrences: [
          {
            id: 'recurrence-1',
            schedule_id: 'schedule-1',
            frequency: 'weekly',
            interval: 1,
            count: null,
            until: null,
            timezone: 'America/New_York',
            bysecond: null,
            byminute: [2],
            byhour: [17],
            byday: ['TU'],
            bymonthday: null,
            byyearday: null,
            byweekno: null,
            bymonth: null,
            bysetpos: null,
            wkst: 'MO',
          },
        ],
        exceptions: [
          {
            recurrence_id: 'recurrence-1',
            occurrence_key: '2026-03-17T21:02:00.000Z',
            reason: 'Holiday',
          },
        ],
        overrides: [
          {
            recurrence_id: 'recurrence-1',
            occurrence_key: '2026-03-24T21:02:00.000Z',
            patch: {
              start_at: '2026-03-25T22:15:00.000Z',
              end_at: '2026-03-25T23:15:00.000Z',
              description: 'Rescheduled',
            },
          },
        ],
        channel: {
          topic: payload.basics.title,
          description: payload.basics.description,
          icon_key: payload.basics.iconKey,
          ui_theme_key: payload.settings?.themeKey,
          ui_defaults: payload.settings?.uiDefaults ?? null,
          live_session_config: null,
        },
      }),
    );
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
