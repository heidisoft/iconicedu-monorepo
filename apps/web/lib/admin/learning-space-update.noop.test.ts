import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  createSupabaseServiceClientMock,
  requireParentActorContextMock,
  getAccountByAuthUserIdMock,
  getProfileByAccountIdMock,
  publishActivityEventMock,
  compileLearningSpaceReminderJobsMock,
  ensureSystemProfileIdMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  createSupabaseServiceClientMock: vi.fn(),
  requireParentActorContextMock: vi.fn(),
  getAccountByAuthUserIdMock: vi.fn(),
  getProfileByAccountIdMock: vi.fn(),
  publishActivityEventMock: vi.fn(),
  compileLearningSpaceReminderJobsMock: vi.fn(),
  ensureSystemProfileIdMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
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

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: publishActivityEventMock,
}));

vi.mock('@iconicedu/web/lib/automation/reminder-jobs', () => ({
  compileLearningSpaceReminderJobs: compileLearningSpaceReminderJobsMock,
}));

vi.mock('@iconicedu/web/lib/automation/system-profile', () => ({
  ensureSystemProfileId: ensureSystemProfileIdMock,
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

function createSelectManyChain<T>(result: {
  data: T;
  error: { message: string } | null;
}) {
  const chain = {
    error: null as { message: string } | null,
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    returns: vi.fn(async () => result),
  };
  const mutationChain = {
    error: null as { message: string } | null,
    eq: vi.fn(() => mutationChain),
    is: vi.fn(() => mutationChain),
  };
  const insertChain = {
    select: vi.fn(async () => ({
      data: [{ id: 'mock-row-id' }],
      error: null as { message: string } | null,
    })),
  };

  return {
    select: vi.fn(() => chain),
    delete: vi.fn(() => mutationChain),
    update: vi.fn(() => mutationChain),
    insert: vi.fn(() => insertChain),
    upsert: vi.fn(() => insertChain),
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

describe('updateLearningSpaceFromPayload no-op behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
    requireParentActorContextMock.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-actor-1', account_id: 'account-1', org_id: 'org-1' },
      source: 'parent',
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
      resources: [
        {
          label: 'Syllabus',
          iconKey: 'file-text',
          url: 'https://example.com/syllabus',
          status: 'active',
          hidden: false,
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

    const participantsTable = createSelectManyChain({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const schedulesTable = createSelectManyChain({
      data: [
        {
          id: 'schedule-1',
          title: payload.basics.title,
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      error: null,
    });
    const recurrencesTable = createSelectManyChain({
      data: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
      error: null,
    });
    const recurrenceExceptionsTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const recurrenceOverridesTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const linksTable = createSelectManyChain({
      data: [
        {
          label: 'Syllabus',
          icon_key: 'file-text',
          url: 'https://example.com/syllabus',
          status: 'active',
          hidden: false,
        },
      ],
      error: null,
    });
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
    const profilesTable = createSelectManyChain({
      data: [
        {
          id: 'profile-1',
          display_name: 'Alex Educator',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    });

    const serviceMutationTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_space_participants':
            return participantsTable;
          case 'class_schedules':
            return schedulesTable;
          case 'learning_space_links':
            return linksTable;
          case 'class_schedule_recurrence':
            return recurrencesTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsTable;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesTable;
          case 'channels':
            return channelsTable;
          case 'profiles':
            return profilesTable;
          default:
            return serviceMutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
    expect(compileLearningSpaceReminderJobsMock).not.toHaveBeenCalled();
    expect(ensureSystemProfileIdMock).not.toHaveBeenCalled();
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
      resources: [
        {
          label: 'Syllabus',
          iconKey: 'file-text',
          url: 'https://example.com/syllabus',
          status: 'active',
          hidden: false,
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

    const participantsTable = createSelectManyChain({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const schedulesTable = createSelectManyChain({
      data: [
        {
          id: 'schedule-1',
          title: payload.basics.title,
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      error: null,
    });
    const recurrencesTable = createSelectManyChain({
      data: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
      error: null,
    });
    const recurrenceExceptionsTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const recurrenceOverridesTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const linksTable = createSelectManyChain({
      data: [
        {
          label: 'Syllabus',
          icon_key: 'file-text',
          url: 'https://example.com/syllabus',
          status: 'active',
          hidden: false,
        },
      ],
      error: null,
    });
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
    const profilesTable = createSelectManyChain({
      data: [
        {
          id: 'profile-1',
          display_name: 'Alex Educator',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    });

    const serviceMutationTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_space_participants':
            return participantsTable;
          case 'class_schedules':
            return schedulesTable;
          case 'learning_space_links':
            return linksTable;
          case 'class_schedule_recurrence':
            return recurrencesTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsTable;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesTable;
          case 'channels':
            return channelsTable;
          case 'profiles':
            return profilesTable;
          default:
            return serviceMutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });
    ensureSystemProfileIdMock.mockResolvedValue('system-profile-1');
    publishActivityEventMock.mockResolvedValue({ id: 'activity-1' });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(compileLearningSpaceReminderJobsMock).not.toHaveBeenCalled();
    expect(publishActivityEventMock).toHaveBeenCalledTimes(1);
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'class.updated',
      }),
    );
  });

  it('emits class.updated and class.session.rescheduled for schedule override edits', async () => {
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
      resources: [
        {
          label: 'Syllabus',
          iconKey: 'file-text',
          url: 'https://example.com/syllabus',
          status: 'active',
          hidden: false,
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

    const participantsTable = createSelectManyChain({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const schedulesTable = createSelectManyChain({
      data: [
        {
          id: 'schedule-1',
          title: payload.basics.title,
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      error: null,
    });
    const recurrencesTable = createSelectManyChain({
      data: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
      error: null,
    });
    const recurrenceExceptionsTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const recurrenceOverridesTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const linksTable = createSelectManyChain({
      data: [
        {
          label: 'Syllabus',
          icon_key: 'file-text',
          url: 'https://example.com/syllabus',
          status: 'active',
          hidden: false,
        },
      ],
      error: null,
    });
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
    const profilesTable = createSelectManyChain({
      data: [
        {
          id: 'profile-1',
          display_name: 'Alex Educator',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    });

    const serviceMutationTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_space_participants':
            return participantsTable;
          case 'class_schedules':
            return schedulesTable;
          case 'learning_space_links':
            return linksTable;
          case 'class_schedule_recurrence':
            return recurrencesTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsTable;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesTable;
          case 'channels':
            return channelsTable;
          case 'profiles':
            return profilesTable;
          default:
            return serviceMutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });
    ensureSystemProfileIdMock.mockResolvedValue('system-profile-1');
    publishActivityEventMock.mockResolvedValue({ id: 'activity-1' });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(compileLearningSpaceReminderJobsMock).toHaveBeenCalledTimes(1);
    expect(compileLearningSpaceReminderJobsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        learningSpaceId: 'space-1',
      }),
    );
    expect(publishActivityEventMock).toHaveBeenCalledTimes(2);
    expect(publishActivityEventMock.mock.calls.map(([input]) => input.eventType)).toEqual(
      ['class.updated', 'class.session.rescheduled'],
    );
    expect(publishActivityEventMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventType: 'class.updated',
        payload: expect.objectContaining({
          changeSummary: expect.stringContaining('Class schedule has been updated'),
        }),
      }),
    );
    expect(publishActivityEventMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'class.session.rescheduled',
        payload: expect.objectContaining({
          title: 'Math Foundations',
          invitedMembers: [],
          rescheduledFromStartAt: '2026-03-21',
          rescheduledToStartAt: '2026-03-21T15:00:00.000Z',
          rescheduledReason: 'Rescheduled',
        }),
      }),
    );

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('emits class.session.canceled for added exceptions even when base schedule also changes', async () => {
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
      resources: [],
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

    const participantsTable = createSelectManyChain({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const schedulesTable = createSelectManyChain({
      data: [
        {
          id: 'schedule-1',
          title: payload.basics.title,
          start_at: '2026-03-14T14:00:00.000Z',
          end_at: '2026-03-14T15:00:00.000Z',
          timezone: 'UTC',
        },
      ],
      error: null,
    });
    const recurrencesTable = createSelectManyChain({
      data: [{ id: 'recurrence-1', schedule_id: 'schedule-1' }],
      error: null,
    });
    const recurrenceExceptionsTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const recurrenceOverridesTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const linksTable = createSelectManyChain({
      data: [],
      error: null,
    });
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
    const profilesTable = createSelectManyChain({
      data: [
        {
          id: 'profile-1',
          display_name: 'Alex Educator',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    });

    const serviceMutationTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_space_participants':
            return participantsTable;
          case 'class_schedules':
            return schedulesTable;
          case 'learning_space_links':
            return linksTable;
          case 'class_schedule_recurrence':
            return recurrencesTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsTable;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesTable;
          case 'channels':
            return channelsTable;
          case 'profiles':
            return profilesTable;
          default:
            return serviceMutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });
    ensureSystemProfileIdMock.mockResolvedValue('system-profile-1');
    publishActivityEventMock.mockResolvedValue({ id: 'activity-1' });

    await updateLearningSpaceFromPayload('space-1', payload);

    const eventTypes = publishActivityEventMock.mock.calls.map(
      ([input]) => input.eventType,
    );
    expect(eventTypes).toContain('class.updated');
    expect(eventTypes).toContain('class.session.rescheduled');
    expect(eventTypes).toContain('class.session.canceled');
  });

  it('emits plural class.sessions.rescheduled when multiple schedules are rescheduled', async () => {
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
      resources: [],
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

    const participantsTable = createSelectManyChain({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const schedulesTable = createSelectManyChain({
      data: [
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
      error: null,
    });
    const recurrencesTable = createSelectManyChain({
      data: [
        { id: 'recurrence-1', schedule_id: 'schedule-1' },
        { id: 'recurrence-2', schedule_id: 'schedule-2' },
      ],
      error: null,
    });
    const recurrenceExceptionsTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const recurrenceOverridesTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const linksTable = createSelectManyChain({
      data: [],
      error: null,
    });
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
    const profilesTable = createSelectManyChain({
      data: [
        {
          id: 'profile-1',
          display_name: 'Alex Educator',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    });

    const serviceMutationTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_space_participants':
            return participantsTable;
          case 'class_schedules':
            return schedulesTable;
          case 'learning_space_links':
            return linksTable;
          case 'class_schedule_recurrence':
            return recurrencesTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsTable;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesTable;
          case 'channels':
            return channelsTable;
          case 'profiles':
            return profilesTable;
          default:
            return serviceMutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });
    ensureSystemProfileIdMock.mockResolvedValue('system-profile-1');
    publishActivityEventMock.mockResolvedValue({ id: 'activity-1' });

    await updateLearningSpaceFromPayload('space-1', payload);

    const eventTypes = publishActivityEventMock.mock.calls.map(
      ([input]) => input.eventType,
    );
    expect(eventTypes).toContain('class.updated');
    expect(eventTypes).not.toContain('class.session.rescheduled');
    expect(
      eventTypes.filter((eventType) => eventType === 'class.sessions.rescheduled'),
    ).toHaveLength(2);
  });

  it('treats empty resource placeholder rows as no-op changes', async () => {
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
      resources: [
        {
          label: '   ',
          iconKey: null,
          url: null,
          status: null,
          hidden: null,
        },
      ],
      schedules: [],
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

    const participantsTable = createSelectManyChain({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const schedulesTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const recurrencesTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const recurrenceExceptionsTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const recurrenceOverridesTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const linksTable = createSelectManyChain({
      data: [],
      error: null,
    });
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
    const profilesTable = createSelectManyChain({
      data: [
        {
          id: 'profile-1',
          display_name: 'Alex Educator',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    });

    const serviceMutationTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_space_participants':
            return participantsTable;
          case 'class_schedules':
            return schedulesTable;
          case 'learning_space_links':
            return linksTable;
          case 'class_schedule_recurrence':
            return recurrencesTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsTable;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesTable;
          case 'channels':
            return channelsTable;
          case 'profiles':
            return profilesTable;
          default:
            return serviceMutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
    expect(compileLearningSpaceReminderJobsMock).not.toHaveBeenCalled();
    expect(ensureSystemProfileIdMock).not.toHaveBeenCalled();
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
      resources: [],
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

    const participantsTable = createSelectManyChain({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const schedulesTable = createSelectManyChain({
      data: [
        {
          id: 'schedule-1',
          title: payload.basics.title,
          start_at: '2026-03-10T21:02:00.000Z',
          end_at: '2026-03-10T22:02:00.000Z',
          timezone: 'America/New_York',
        },
      ],
      error: null,
    });
    const recurrencesTable = createSelectManyChain({
      data: [
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
      error: null,
    });
    const recurrenceExceptionsTable = createSelectManyChain({
      data: [
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
      error: null,
    });
    const recurrenceOverridesTable = createSelectManyChain({
      data: [
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
      error: null,
    });
    const linksTable = createSelectManyChain({
      data: [],
      error: null,
    });
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
    const profilesTable = createSelectManyChain({
      data: [
        {
          id: 'profile-1',
          display_name: 'Ms Charmain',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    });

    const serviceMutationTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_space_participants':
            return participantsTable;
          case 'class_schedules':
            return schedulesTable;
          case 'learning_space_links':
            return linksTable;
          case 'class_schedule_recurrence':
            return recurrencesTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsTable;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesTable;
          case 'channels':
            return channelsTable;
          case 'profiles':
            return profilesTable;
          default:
            return serviceMutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
    expect(compileLearningSpaceReminderJobsMock).not.toHaveBeenCalled();
    expect(ensureSystemProfileIdMock).not.toHaveBeenCalled();
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
      resources: [],
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

    const participantsTable = createSelectManyChain({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const schedulesTable = createSelectManyChain({
      data: [
        {
          id: 'schedule-1',
          title: payload.basics.title,
          start_at: '2026-03-10T21:02:00.000Z',
          end_at: '2026-03-10T22:02:00.000Z',
          timezone: 'America/New_York',
        },
      ],
      error: null,
    });
    const recurrencesTable = createSelectManyChain({
      data: [
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
      error: null,
    });
    const recurrenceExceptionsTable = createSelectManyChain({
      data: [
        {
          recurrence_id: 'recurrence-1',
          occurrence_key: '2026-03-17T21:02:00.000Z',
          reason: 'Holiday',
        },
      ],
      error: null,
    });
    const recurrenceOverridesTable = createSelectManyChain({
      data: [
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
      error: null,
    });
    const linksTable = createSelectManyChain({
      data: [],
      error: null,
    });
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
    const profilesTable = createSelectManyChain({
      data: [
        {
          id: 'profile-1',
          display_name: 'Ms Charmain',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    });

    const serviceMutationTable = createSelectManyChain({
      data: [],
      error: null,
    });
    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'learning_space_participants':
            return participantsTable;
          case 'class_schedules':
            return schedulesTable;
          case 'learning_space_links':
            return linksTable;
          case 'class_schedule_recurrence':
            return recurrencesTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsTable;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesTable;
          case 'channels':
            return channelsTable;
          case 'profiles':
            return profilesTable;
          default:
            return serviceMutationTable;
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(serverClient);
    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
    });
    getProfileByAccountIdMock.mockResolvedValue({ data: { id: 'profile-actor-1' } });

    await updateLearningSpaceFromPayload('space-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
    expect(compileLearningSpaceReminderJobsMock).not.toHaveBeenCalled();
    expect(ensureSystemProfileIdMock).not.toHaveBeenCalled();
  });
});
