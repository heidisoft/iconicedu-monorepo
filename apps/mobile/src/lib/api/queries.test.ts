import {
  cancelRecurringSessionOccurrence,
  fetchChannelMetaByChannelId,
  fetchDirectMessageChannelMetaByChannelId,
  fetchSpaceSchedulesByChannelId,
  fetchActivityFeed,
  fetchSupervisedDirectMessages,
  filterVisibleMessageRows,
  sendFileMessage,
  sendFilesMessage,
  sendTextMessage,
  toggleReaction,
  queryKeys,
} from './queries';
import { mapRowToMessageVM, type RawMessageRow } from './map-row-to-vm';

// ─── Supabase mock ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: 'token-123' } },
      })),
      getUser: jest.fn(async () => ({
        data: { user: { id: 'auth-user-1' } },
      })),
    },
  },
}));

const mockApiPost = jest.fn();
const mockApiGet = jest.fn();
const mockApiDelete = jest.fn();
const mockApiPut = jest.fn();

jest.mock('@/lib/api/http-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
}));

// Build a chainable Supabase query mock that resolves at .order()
function createQueryChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.select = jest.fn(returnChain);
  chain.eq = jest.fn(returnChain);
  chain.is = jest.fn(returnChain);
  chain.order = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createSelectMaybeSingleChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.select = jest.fn(returnChain);
  chain.eq = jest.fn(returnChain);
  chain.in = jest.fn(returnChain);
  chain.is = jest.fn(returnChain);
  chain.order = jest.fn(returnChain);
  chain.limit = jest.fn(returnChain);
  chain.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createInsertSingleChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.insert = jest.fn(returnChain);
  chain.select = jest.fn(returnChain);
  chain.single = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createInsertChain(resolvedValue: { error: unknown }) {
  return {
    insert: jest.fn().mockResolvedValue(resolvedValue),
  };
}

function createUpdateChain(resolvedValue: { error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.update = jest.fn(returnChain);
  chain.eq = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createUpsertChain(resolvedValue: { error: unknown }) {
  return {
    upsert: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── Test data ──────────────────────────────────────────────────────────────────

const CHANNEL_ID = 'ch-test-1';
const ORG_ID = 'org-test-1';

const minimalRow = {
  id: 'sched-1',
  org_id: ORG_ID,
  title: 'Math Class',
  description: null,
  location: null,
  meeting_link: 'https://meet.example.com',
  start_at: '2026-03-01T10:00:00Z',
  end_at: '2026-03-01T11:00:00Z',
  timezone: null,
  status: 'scheduled',
  visibility: 'private',
  theme_key: null,
  source_kind: 'class_session',
  source_learning_space_id: 'space-1',
  source_channel_id: CHANNEL_ID,
  source_session_id: null,
  source_owner_user_id: null,
  source_created_by_user_id: null,
  source_related_learning_space_id: null,
  created_at: '2026-01-01T00:00:00Z',
  created_by: 'user-1',
  updated_at: null,
  updated_by: null,
  participants: [],
  recurrence: null,
};

// ─── fetchSpaceSchedulesByChannelId ────────────────────────────────────────────

describe('fetchSpaceSchedulesByChannelId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the schedules API with channel and org filters', async () => {
    mockApiGet.mockResolvedValue([]);

    await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(mockApiGet).toHaveBeenCalledWith('/schedules', {
      orgId: ORG_ID,
      channelId: CHANNEL_ID,
    });
  });

  it('returns empty array when there are no matching schedules', async () => {
    mockApiGet.mockResolvedValue([]);

    const result = await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('maps a schedule row to ClassScheduleVM', async () => {
    mockApiGet.mockResolvedValue([minimalRow]);

    const result = await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ids: { id: 'sched-1', orgId: ORG_ID },
      title: 'Math Class',
      meetingLink: 'https://meet.example.com',
      startAt: '2026-03-01T10:00:00Z',
      endAt: '2026-03-01T11:00:00Z',
      status: 'scheduled',
      visibility: 'private',
      source: {
        kind: 'class_session',
        learningSpaceId: 'space-1',
        channelId: CHANNEL_ID,
      },
      participants: [],
      recurrence: undefined,
    });
  });

  it('maps recurrence data when present', async () => {
    const rowWithRecurrence = {
      ...minimalRow,
      recurrence: [
        {
          id: 'rec-1',
          org_id: ORG_ID,
          frequency: 'weekly',
          interval: 1,
          count: null,
          until: '2026-06-01',
          timezone: null,
          byday: ['MO', 'WE'],
          exceptions: [
            { id: 'exc-1', occurrence_key: '2026-03-09T10:00:00Z', reason: 'Holiday' },
          ],
          overrides: [],
        },
      ],
    };
    mockApiGet.mockResolvedValue([rowWithRecurrence]);

    const result = await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(result[0]!.recurrence).toBeDefined();
    expect(result[0]!.recurrence!.rule.frequency).toBe('weekly');
    expect(result[0]!.recurrence!.rule.interval).toBe(1);
    expect(result[0]!.recurrence!.rule.byWeekday).toEqual(['MO', 'WE']);
    expect(result[0]!.recurrence!.rule.until).toBe('2026-06-01');
    expect(result[0]!.recurrence!.exceptions).toHaveLength(1);
    expect(result[0]!.recurrence!.exceptions![0]!.occurrenceKey).toBe(
      '2026-03-09T10:00:00Z',
    );
    expect(result[0]!.recurrence!.exceptions![0]!.reason).toBe('Holiday');
    expect(result[0]!.recurrence!.overrides).toHaveLength(0);
  });

  it('maps multiple participants', async () => {
    const rowWithParticipants = {
      ...minimalRow,
      participants: [
        {
          id: 'p-1',
          org_id: ORG_ID,
          profile_id: 'profile-teacher-1',
          role: 'teacher',
          status: 'accepted',
          display_name: 'Ms Smith',
          avatar_url: null,
          theme_key: null,
        },
        {
          id: 'p-2',
          org_id: ORG_ID,
          profile_id: 'profile-student-1',
          role: 'student',
          status: 'pending',
          display_name: 'Jane',
          avatar_url: 'https://img/a.png',
          theme_key: 'teal',
        },
      ],
    };
    mockApiGet.mockResolvedValue([rowWithParticipants]);

    const result = await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(result[0]!.participants).toHaveLength(2);
    expect(result[0]!.participants[0]).toMatchObject({
      ids: { id: 'profile-teacher-1' },
      role: 'teacher',
      displayName: 'Ms Smith',
    });
    expect(result[0]!.participants[1]).toMatchObject({
      ids: { id: 'profile-student-1' },
      role: 'student',
      avatarUrl: 'https://img/a.png',
      themeKey: 'teal',
    });
  });

  it('handles null data gracefully', async () => {
    mockApiGet.mockResolvedValue(null);

    const result = await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('throws when the schedules API returns an error', async () => {
    mockApiGet.mockRejectedValue(new Error('Connection refused'));

    await expect(fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID)).rejects.toThrow(
      'Connection refused',
    );
  });
});

describe('cancelRecurringSessionOccurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts a recurrence exception through the API and returns the inserted occurrence info', async () => {
    mockApiPost.mockResolvedValue({
      occurrence_key: '2026-03-10T14:30:00.000Z',
      reason: 'Staffing conflict',
    });

    const result = await cancelRecurringSessionOccurrence({
      orgId: ORG_ID,
      recurrenceId: 'rec-1',
      occurrenceKey: '2026-03-10T14:30:00.000Z',
      reason: 'Staffing conflict',
    });

    expect(mockApiPost).toHaveBeenCalledWith('/schedules/exceptions', {
      orgId: ORG_ID,
      scheduleId: 'rec-1',
      date: '2026-03-10T14:30:00.000Z',
      reason: 'Staffing conflict',
    });
    expect(result).toEqual({
      occurrenceKey: '2026-03-10T14:30:00.000Z',
      reason: 'Staffing conflict',
    });
  });
});

describe('sendTextMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts text messages through the API and returns the message id', async () => {
    mockApiPost.mockResolvedValue({ id: 'message-1' });

    const result = await sendTextMessage(
      'channel-1',
      'profile-1',
      'org-1',
      '  Hello mobile  ',
      'parent-1',
      'thread-123',
    );

    expect(mockApiPost).toHaveBeenCalledWith('/messages/text', {
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: 'Hello mobile',
      threadParentId: 'parent-1',
      threadId: 'thread-123',
    });
    expect(result).toEqual({ id: 'message-1' });
  });

  it('rejects blank messages before writing to Supabase', async () => {
    await expect(
      sendTextMessage('channel-1', 'profile-1', 'org-1', '   '),
    ).rejects.toThrow('Message text is required');

    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

describe('sendFileMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts single file messages through the API and returns the message id', async () => {
    mockApiPost.mockResolvedValue({ id: 'file-message-1' });

    const result = await sendFileMessage(
      'channel-1',
      'profile-1',
      'org-1',
      {
        name: 'notes.pdf',
        storagePath: 'org-1/channel-1/files/profile-1/notes.pdf',
        mimeType: 'application/pdf',
        size: 1234,
        durationSeconds: 9,
      },
      'caption',
      'parent-1',
      'thread-123',
    );

    expect(mockApiPost).toHaveBeenCalledWith('/messages/file', {
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      name: 'notes.pdf',
      storagePath: 'org-1/channel-1/files/profile-1/notes.pdf',
      mimeType: 'application/pdf',
      size: 1234,
      durationSeconds: 9,
      content: 'caption',
      threadParentId: 'parent-1',
      threadId: 'thread-123',
    });
    expect(result).toEqual({ id: 'file-message-1' });
  });
});

describe('sendFilesMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts multi-file messages through the API and returns the message id', async () => {
    mockApiPost.mockResolvedValue({ id: 'files-message-1' });

    const result = await sendFilesMessage(
      'channel-1',
      'profile-1',
      'org-1',
      [
        {
          name: 'a.png',
          storagePath: 'org-1/channel-1/images/profile-1/a.png',
          mimeType: 'image/png',
          size: 111,
        },
        {
          name: 'b.png',
          storagePath: 'org-1/channel-1/images/profile-1/b.png',
          mimeType: 'image/png',
          size: 222,
        },
      ],
      'caption',
      'parent-1',
      'thread-123',
    );

    expect(mockApiPost).toHaveBeenCalledWith('/messages/files', {
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      assets: [
        {
          name: 'a.png',
          storagePath: 'org-1/channel-1/images/profile-1/a.png',
          mimeType: 'image/png',
          size: 111,
        },
        {
          name: 'b.png',
          storagePath: 'org-1/channel-1/images/profile-1/b.png',
          mimeType: 'image/png',
          size: 222,
        },
      ],
      content: 'caption',
      threadParentId: 'parent-1',
      threadId: 'thread-123',
    });
    expect(result).toEqual({ id: 'files-message-1' });
  });

  it('rejects empty file batches before calling the API', async () => {
    await expect(sendFilesMessage('channel-1', 'profile-1', 'org-1', [])).rejects.toThrow(
      'No files provided',
    );

    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ─── fetchActivityFeed ─────────────────────────────────────────────────────────

const ORG_ID_FEED = 'org-feed-1';
const PROFILE_ID = 'profile-1';

const leafRow = {
  id: 'item-1',
  org_id: ORG_ID_FEED,
  recipient_profile_id: PROFILE_ID,
  source_event_id: null,
  kind: 'leaf',
  occurred_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  tab_key: 'classes',
  audience: { scope: { kind: 'global' }, visibility: 'public' },
  verb: 'summary.posted',
  actor_profile_id: null,
  refs: {},
  content: { headline: { primary: 'Priya posted a session summary' } },
  summary: null,
  preview: null,
  action_button: null,
  expanded_content: null,
  importance: null,
  is_read: false,
  read_at: null,
  dedupe_key: null,
  metadata: null,
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

describe('fetchActivityFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the activity-feed API with org and profile filters', async () => {
    mockApiGet.mockResolvedValue({
      sections: [],
      unreadCount: 0,
      activeTab: 'all',
      tabs: [],
    });

    await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    expect(mockApiGet).toHaveBeenCalledWith('/activity-feed', {
      orgId: ORG_ID_FEED,
      profileId: PROFILE_ID,
    });
  });

  it('returns the API payload unchanged for empty feeds', async () => {
    mockApiGet.mockResolvedValue({
      sections: [],
      unreadCount: 0,
      activeTab: 'all',
      tabs: [
        { key: 'all', label: 'All', badgeCount: 0 },
        { key: 'classes', label: 'Classes', badgeCount: 0 },
      ],
    });

    const result = await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    expect(result.sections).toEqual([]);
    expect(result.unreadCount).toBe(0);
    expect(result.activeTab).toBe('all');
    expect(result.tabs).toHaveLength(2);
  });

  it('returns hydrated feed payloads from the API unchanged', async () => {
    mockApiGet.mockResolvedValue({
      sections: [
        {
          id: 'today',
          label: 'Today',
          items: [
            {
              ...leafRow,
              ids: { id: 'item-1', orgId: ORG_ID_FEED },
              state: { isRead: false },
            },
          ],
        },
      ],
      unreadCount: 1,
      activeTab: 'all',
      tabs: [
        { key: 'all', label: 'All', badgeCount: 1 },
        { key: 'classes', label: 'Classes', badgeCount: 1 },
      ],
    });

    const result = await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.label).toBe('Today');
    expect(result.unreadCount).toBe(1);
    expect(result.tabs.find((tab) => tab.key === 'classes')?.badgeCount).toBe(1);
  });

  it('throws when the activity-feed API returns an error', async () => {
    mockApiGet.mockRejectedValue(new Error('DB error'));

    await expect(fetchActivityFeed(ORG_ID_FEED, PROFILE_ID)).rejects.toThrow('DB error');
  });
});

// ─── toggleReaction ────────────────────────────────────────────────────────────

const MSG_ID = 'msg-1';
const ACCOUNT_ID = 'acct-1';
const REACTION_PROFILE_ID = 'profile-1';
const EMOJI = '👍';
const ORG = 'org-1';

describe('toggleReaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiPost.mockResolvedValue(undefined);
    mockApiDelete.mockResolvedValue(undefined);
  });

  it('calls apiPost /reactions when reactedByMe is false', async () => {
    await toggleReaction(MSG_ID, ACCOUNT_ID, REACTION_PROFILE_ID, EMOJI, ORG, false);

    expect(mockApiPost).toHaveBeenCalledWith('/reactions', {
      orgId: ORG,
      messageId: MSG_ID,
      emoji: EMOJI,
      accountId: ACCOUNT_ID,
      profileId: REACTION_PROFILE_ID,
    });
    expect(mockApiDelete).not.toHaveBeenCalled();
  });

  it('calls apiDelete /reactions when reactedByMe is true', async () => {
    await toggleReaction(MSG_ID, ACCOUNT_ID, REACTION_PROFILE_ID, EMOJI, ORG, true);

    expect(mockApiDelete).toHaveBeenCalledWith('/reactions', {
      orgId: ORG,
      messageId: MSG_ID,
      emoji: EMOJI,
      accountId: ACCOUNT_ID,
      profileId: REACTION_PROFILE_ID,
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ─── fetchSupervisedDirectMessages ─────────────────────────────────────────────

const SUP_ORG = 'org-sup-1';
const GUARDIAN_ACCOUNT_ID = 'acct-guardian-1';
const GUARDIAN_PROFILE_ID = 'prof-guardian-1';

describe('fetchSupervisedDirectMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the supervised DM API with guardian context', async () => {
    mockApiGet.mockResolvedValue([]);

    await fetchSupervisedDirectMessages(
      SUP_ORG,
      GUARDIAN_ACCOUNT_ID,
      GUARDIAN_PROFILE_ID,
    );

    expect(mockApiGet).toHaveBeenCalledWith('/channels/supervised-dms', {
      orgId: SUP_ORG,
      guardianAccountId: GUARDIAN_ACCOUNT_ID,
      guardianProfileId: GUARDIAN_PROFILE_ID,
    });
  });

  it('does not short-circuit empty params and leaves validation to the API', async () => {
    mockApiGet.mockResolvedValue([]);

    await fetchSupervisedDirectMessages('', GUARDIAN_ACCOUNT_ID, GUARDIAN_PROFILE_ID);

    expect(mockApiGet).toHaveBeenCalledWith('/channels/supervised-dms', {
      orgId: '',
      guardianAccountId: GUARDIAN_ACCOUNT_ID,
      guardianProfileId: GUARDIAN_PROFILE_ID,
    });
  });

  it('returns the API payload as channel list items', async () => {
    mockApiGet.mockResolvedValue([
      {
        id: 'ch-supervised-1',
        org_id: SUP_ORG,
        kind: 'dm',
        is_supervised: true,
        supervised_child_name: 'Alice',
        participants: [{ id: 'prof-teacher-1', display_name: 'Ms Smith' }],
      },
    ]);

    const result = await fetchSupervisedDirectMessages(
      SUP_ORG,
      GUARDIAN_ACCOUNT_ID,
      GUARDIAN_PROFILE_ID,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('ch-supervised-1');
    expect(result[0]!.is_supervised).toBe(true);
    expect(result[0]!.supervised_child_name).toBe('Alice');
    expect(result[0]!.participants).toHaveLength(1);
    expect(result[0]!.participants![0]!.id).toBe('prof-teacher-1');
  });

  it('surfaces API failures', async () => {
    mockApiGet.mockRejectedValue(new Error('Forbidden'));

    await expect(
      fetchSupervisedDirectMessages(SUP_ORG, GUARDIAN_ACCOUNT_ID, GUARDIAN_PROFILE_ID),
    ).rejects.toThrow('Forbidden');
  });
});

describe('fetchDirectMessageChannelMetaByChannelId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the DM metadata API with profile context', async () => {
    mockApiGet.mockResolvedValue({ id: 'ch-1', kind: 'dm', participants: [] });

    const result = await fetchDirectMessageChannelMetaByChannelId(
      SUP_ORG,
      GUARDIAN_PROFILE_ID,
      GUARDIAN_ACCOUNT_ID,
      'ch-1',
    );

    expect(mockApiGet).toHaveBeenCalledWith('/channels/ch-1/dm-meta', {
      orgId: SUP_ORG,
      profileId: GUARDIAN_PROFILE_ID,
      accountId: GUARDIAN_ACCOUNT_ID,
    });
    expect(result).toMatchObject({ id: 'ch-1', kind: 'dm' });
  });

  it('returns null when required identifiers are missing', async () => {
    await expect(
      fetchDirectMessageChannelMetaByChannelId('', GUARDIAN_PROFILE_ID, 'acct-1', 'ch-1'),
    ).resolves.toBeNull();

    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('fetchChannelMetaByChannelId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the channel metadata API with account context', async () => {
    mockApiGet.mockResolvedValue({ id: 'channel-1', kind: 'channel' });

    const result = await fetchChannelMetaByChannelId(
      SUP_ORG,
      GUARDIAN_ACCOUNT_ID,
      'channel-1',
    );

    expect(mockApiGet).toHaveBeenCalledWith('/channels/channel-1/meta', {
      orgId: SUP_ORG,
      accountId: GUARDIAN_ACCOUNT_ID,
    });
    expect(result).toMatchObject({ id: 'channel-1', kind: 'channel' });
  });

  it('returns null when required identifiers are missing', async () => {
    await expect(
      fetchChannelMetaByChannelId('', GUARDIAN_ACCOUNT_ID, 'channel-1'),
    ).resolves.toBeNull();

    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('filterVisibleMessageRows', () => {
  it('keeps public rows visible to everyone', () => {
    const rows = [
      {
        id: 'msg-public-1',
        org_id: ORG_ID,
        channel_id: CHANNEL_ID,
        sender_profile_id: 'profile-staff-1',
        visibility_type: 'all' as const,
        visibility_user_ids: null,
        type: 'text',
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
        sender: {
          id: 'profile-staff-1',
          display_name: 'Support',
          first_name: null,
          last_name: null,
          avatar_url: null,
          avatar_seed: null,
          kind: 'staff',
        },
      },
    ];

    expect(filterVisibleMessageRows(rows, 'profile-child-1')).toEqual(rows);
  });

  it('hides specific-users rows when the effective profile is not allowed', () => {
    const rows = [
      {
        id: 'msg-private-1',
        org_id: ORG_ID,
        channel_id: CHANNEL_ID,
        sender_profile_id: 'profile-other-child-1',
        visibility_type: 'specific-users' as const,
        visibility_user_ids: ['profile-other-child-1', 'profile-staff-1'],
        type: 'text',
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
        sender: {
          id: 'profile-other-child-1',
          display_name: 'Other Child',
          first_name: null,
          last_name: null,
          avatar_url: null,
          avatar_seed: null,
          kind: 'child',
        },
      },
    ];

    expect(filterVisibleMessageRows(rows, 'profile-child-1')).toEqual([]);
  });

  it('keeps specific-users rows when the effective profile is allowed', () => {
    const rows = [
      {
        id: 'msg-private-1',
        org_id: ORG_ID,
        channel_id: CHANNEL_ID,
        sender_profile_id: 'profile-child-1',
        visibility_type: 'specific-users' as const,
        visibility_user_ids: ['profile-child-1', 'profile-staff-1'],
        type: 'text',
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
        sender: {
          id: 'profile-child-1',
          display_name: 'My Child',
          first_name: null,
          last_name: null,
          avatar_url: null,
          avatar_seed: null,
          kind: 'child',
        },
      },
    ];

    expect(filterVisibleMessageRows(rows, 'profile-child-1')).toEqual(rows);
  });
});

describe('mapRowToMessageVM', () => {
  it('preserves audio-recording text captions from the payload', () => {
    const message = mapRowToMessageVM(
      {
        id: 'msg-audio-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        sender_profile_id: 'profile-1',
        type: 'audio-recording',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        sender: {
          id: 'profile-1',
          display_name: 'Tutor One',
          first_name: null,
          last_name: null,
          avatar_url: null,
          avatar_seed: 'profile-1',
          kind: 'educator',
        },
      } as RawMessageRow,
      {
        url: 'org-1/channel-1/audio.m4a',
        storagePath: 'org-1/channel-1/audio.m4a',
        durationSeconds: 12,
        mimeType: 'audio/mp4',
        text: 'Audio caption text.',
      },
      [],
    );

    expect((message as { content?: { text?: string } }).content?.text).toBe(
      'Audio caption text.',
    );
  });
});

// ─── queryKeys ─────────────────────────────────────────────────────────────────

describe('queryKeys.spaceSchedules', () => {
  it('returns stable tuple key', () => {
    expect(queryKeys.spaceSchedules('ch-1', 'org-1')).toEqual([
      'space-sessions',
      'ch-1',
      'org-1',
    ]);
  });

  it('includes channelId and orgId in key for cache isolation', () => {
    const key1 = queryKeys.spaceSchedules('ch-1', 'org-1');
    const key2 = queryKeys.spaceSchedules('ch-2', 'org-1');
    expect(key1).not.toEqual(key2);
  });
});
