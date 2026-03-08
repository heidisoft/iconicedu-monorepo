import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  createSupabaseServiceClientMock,
  getAccountByAuthUserIdMock,
  getProfileByAccountIdMock,
  publishActivityEventMock,
  compileLearningSpaceReminderJobsMock,
  ensureSystemProfileIdMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  createSupabaseServiceClientMock: vi.fn(),
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
  const chain = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    returns: vi.fn(() => chain),
  };

  return {
    select: vi.fn(() => chain),
  };
}

function createSelectManyChain<T>(result: {
  data: T;
  error: { message: string } | null;
}) {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    returns: vi.fn(async () => result),
  };

  return {
    select: vi.fn(() => chain),
  };
}

describe('updateLearningSpaceFromPayload no-op behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          default:
            throw new Error(`Unexpected server table: ${table}`);
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
            throw new Error(`Unexpected service table: ${table}`);
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
          default:
            throw new Error(`Unexpected server table: ${table}`);
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
            throw new Error(`Unexpected service table: ${table}`);
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
