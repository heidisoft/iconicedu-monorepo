import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  createSupabaseServiceClientMock,
  requireAdminAuthContextMock,
  ensureSystemProfileIdMock,
  publishActivityEventMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  createSupabaseServiceClientMock: vi.fn(),
  requireAdminAuthContextMock: vi.fn(),
  ensureSystemProfileIdMock: vi.fn(),
  publishActivityEventMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

vi.mock('@iconicedu/web/lib/admin/_auth-context', () => ({
  requireAdminAuthContext: requireAdminAuthContextMock,
}));

vi.mock('@iconicedu/web/lib/automation/system-profile', () => ({
  ensureSystemProfileId: ensureSystemProfileIdMock,
}));

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: publishActivityEventMock,
}));

import type { ChannelCreatePayload } from '@iconicedu/shared-types';
import { updateChannelFromPayload } from '@iconicedu/web/lib/admin/channel-update';

function createMaybeSingleTable<T>(result: {
  data: T;
  error: { message: string } | null;
}) {
  const selectChain = {
    eq: vi.fn(() => selectChain),
    is: vi.fn(() => selectChain),
    maybeSingle: vi.fn(async () => result),
  };
  const mutationChain = {
    eq: vi.fn(() => mutationChain),
    is: vi.fn(() => mutationChain),
    error: null as { message: string } | null,
  };

  return {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => mutationChain),
  };
}

function createListTable<T>(result: { data: T; error: { message: string } | null }) {
  const selectChain = {
    eq: vi.fn(() => selectChain),
    returns: vi.fn(async () => result),
  };
  const mutationChain = {
    eq: vi.fn(() => mutationChain),
    error: null as { message: string } | null,
  };

  return {
    select: vi.fn(() => selectChain),
    delete: vi.fn(() => mutationChain),
    insert: vi.fn(async () => ({ error: null })),
  };
}

describe('updateChannelFromPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
    requireAdminAuthContextMock.mockResolvedValue({
      accountId: 'account-1',
      orgId: 'org-1',
      profileId: 'profile-actor-1',
    });
  });

  it('updates changed channels without publishing legacy activity events', async () => {
    const payload: ChannelCreatePayload = {
      basics: {
        kind: 'channel',
        topic: 'Updated channel',
        iconKey: null,
        description: 'Fresh description',
        visibility: 'private',
        purpose: 'general',
      },
      ui: { themeKey: 'teal' },
      liveSession: null,
      postingPolicy: {
        kind: 'members-only',
        allowThreads: true,
        allowReactions: true,
      },
      lifecycle: { status: 'active' },
      participants: [{ profileId: 'profile-1', roleInChannel: null }],
      capabilities: [],
    };

    const channelsTable = createMaybeSingleTable({
      data: {
        topic: 'Original channel',
        description: null,
        icon_key: null,
        visibility: 'private',
        purpose: 'general',
        kind: 'channel',
        ui_theme_key: 'teal',
        ui_defaults: { themeKey: 'teal' },
        live_session_config: null,
        status: 'active',
        posting_policy_kind: 'members-only',
        allow_threads: true,
        allow_reactions: true,
      },
      error: null,
    });
    const membersTable = createListTable({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const capabilitiesTable = createListTable({
      data: [],
      error: null,
    });

    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'channels':
            return channelsTable;
          case 'channel_members':
            return membersTable;
          case 'channel_capabilities':
            return capabilitiesTable;
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(supabase);
    createSupabaseServiceClientMock.mockReturnValue({ from: vi.fn() });
    await updateChannelFromPayload('channel-1', payload);

    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });

  it('defaults group DMs to the classic message UI theme when omitted', async () => {
    const payload: ChannelCreatePayload = {
      basics: {
        kind: 'group_dm',
        topic: 'Group DM',
        iconKey: null,
        description: null,
        visibility: 'private',
        purpose: 'general',
      },
      ui: { themeKey: 'teal' },
      liveSession: null,
      postingPolicy: {
        kind: 'members-only',
        allowThreads: true,
        allowReactions: true,
      },
      lifecycle: { status: 'active' },
      participants: [{ profileId: 'profile-1', roleInChannel: null }],
      capabilities: [],
    };

    const channelsTable = createMaybeSingleTable({
      data: {
        topic: 'Group DM',
        description: null,
        icon_key: null,
        visibility: 'private',
        purpose: 'general',
        kind: 'group_dm',
        ui_theme_key: 'teal',
        ui_defaults: { themeKey: 'teal', messageUiThemeKey: 'classic' },
        live_session_config: null,
        status: 'active',
        posting_policy_kind: 'members-only',
        allow_threads: true,
        allow_reactions: true,
      },
      error: null,
    });
    const membersTable = createListTable({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const capabilitiesTable = createListTable({
      data: [],
      error: null,
    });

    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'channels':
            return channelsTable;
          case 'channel_members':
            return membersTable;
          case 'channel_capabilities':
            return capabilitiesTable;
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(supabase);

    await updateChannelFromPayload('channel-1', payload);

    expect(channelsTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ui_defaults: expect.objectContaining({
          themeKey: 'teal',
          messageUiThemeKey: 'classic',
        }),
      }),
    );
  });

  it('does not publish legacy channel.updated events', async () => {
    const payload: ChannelCreatePayload = {
      basics: {
        kind: 'channel',
        topic: 'Updated channel',
        iconKey: null,
        description: 'Fresh description',
        visibility: 'private',
        purpose: 'general',
      },
      ui: { themeKey: 'teal' },
      liveSession: null,
      postingPolicy: {
        kind: 'members-only',
        allowThreads: true,
        allowReactions: true,
      },
      lifecycle: { status: 'active' },
      participants: [{ profileId: 'profile-1', roleInChannel: null }],
      capabilities: [],
    };

    const channelsTable = createMaybeSingleTable({
      data: {
        topic: 'Original channel',
        description: null,
        icon_key: null,
        visibility: 'private',
        purpose: 'general',
        kind: 'channel',
        ui_theme_key: 'teal',
        ui_defaults: { themeKey: 'teal' },
        live_session_config: null,
        status: 'active',
        posting_policy_kind: 'members-only',
        allow_threads: true,
        allow_reactions: true,
      },
      error: null,
    });
    const membersTable = createListTable({
      data: [{ profile_id: 'profile-1' }],
      error: null,
    });
    const capabilitiesTable = createListTable({
      data: [],
      error: null,
    });

    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'channels':
            return channelsTable;
          case 'channel_members':
            return membersTable;
          case 'channel_capabilities':
            return capabilitiesTable;
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    createSupabaseServerClientMock.mockResolvedValue(supabase);

    await updateChannelFromPayload('channel-1', payload, {
      sendActivityNotifications: false,
    });

    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });
});
