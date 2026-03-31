import {
  fetchSpaceSchedulesByChannelId,
  fetchActivityFeed,
  fetchSupervisedDirectMessages,
  filterVisibleMessageRows,
  sendTextMessage,
  toggleReaction,
  queryKeys,
} from './queries';

// ─── Supabase mock ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: 'token-123' } },
      })),
    },
  },
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

function createDeleteChain(resolvedValue: { error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.delete = jest.fn(returnChain);
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

  it('queries class_schedules table with correct filters', async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(mockFrom).toHaveBeenCalledWith('class_schedules');
    expect(chain.eq).toHaveBeenCalledWith('org_id', ORG_ID);
    expect(chain.eq).toHaveBeenCalledWith('source_kind', 'class_session');
    expect(chain.eq).toHaveBeenCalledWith('source_channel_id', CHANNEL_ID);
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
    expect(chain.order).toHaveBeenCalledWith('start_at', { ascending: true });
  });

  it('never queries learning_space_channels table', async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    const queriedTables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(queriedTables).not.toContain('learning_space_channels');
  });

  it('returns empty array when there are no matching schedules', async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('maps a schedule row to ClassScheduleVM', async () => {
    const chain = createQueryChain({ data: [minimalRow], error: null });
    mockFrom.mockReturnValue(chain);

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
    const chain = createQueryChain({ data: [rowWithRecurrence], error: null });
    mockFrom.mockReturnValue(chain);

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
    const chain = createQueryChain({ data: [rowWithParticipants], error: null });
    mockFrom.mockReturnValue(chain);

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
    const chain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('throws when supabase returns an error', async () => {
    const dbError = new Error('Connection refused');
    const chain = createQueryChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    await expect(fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID)).rejects.toThrow(
      'Connection refused',
    );
  });
});

describe('sendTextMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('posts text messages through the authenticated messages API', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-1' }),
    });

    const result = await sendTextMessage('channel-1', 'profile-1', 'org-1', 'Hello mobile');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/messages/text',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
        }),
        body: JSON.stringify({
          orgId: 'org-1',
          channelId: 'channel-1',
          senderProfileId: 'profile-1',
          content: 'Hello mobile',
          threadParentId: null,
          threadId: null,
        }),
      }),
    );
    expect(result).toEqual({ id: 'msg-1' });
  });

  it('includes thread metadata when posting replies', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'reply-1' }),
    });

    await sendTextMessage(
      'channel-1',
      'profile-1',
      'org-1',
      'Reply text',
      'parent-1',
      'thread-123',
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/messages/text',
      expect.objectContaining({
        body: JSON.stringify({
          orgId: 'org-1',
          channelId: 'channel-1',
          senderProfileId: 'profile-1',
          content: 'Reply text',
          threadParentId: 'parent-1',
          threadId: 'thread-123',
        }),
      }),
    );
  });

  it('surfaces API errors when the server rejects the send', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Channel not found or access denied' }),
    });

    await expect(
      sendTextMessage('channel-1', 'profile-1', 'org-1', 'First reply', 'parent-1'),
    ).rejects.toThrow('Channel not found or access denied');
  });
});

// ─── fetchActivityFeed ─────────────────────────────────────────────────────────

// Chain mock that resolves at .returns() (used by fetchActivityFeed)
function createReturnsChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.select = jest.fn(returnChain);
  chain.eq = jest.fn(returnChain);
  chain.is = jest.fn(returnChain);
  chain.order = jest.fn(returnChain);
  chain.in = jest.fn(returnChain);
  chain.returns = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

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
  group_key: null,
  group_type: null,
  is_collapsed: null,
  sub_activity_count: null,
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

const groupRow = {
  ...leafRow,
  id: 'item-2',
  kind: 'group',
  tab_key: 'classes',
  verb: 'class.session.scheduled',
  group_key: 'sessions-week',
  group_type: 'class',
  sub_activity_count: 2,
  is_collapsed: true,
  content: { headline: { primary: '2 Scheduled Sessions' } },
};

const memberRow1 = {
  id: 'mem-1',
  org_id: ORG_ID_FEED,
  group_id: 'item-2',
  item_id: 'item-1',
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

describe('fetchActivityFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries activity_feed_items with org and profile filters', async () => {
    const itemsChain = createReturnsChain({ data: [], error: null });
    mockFrom.mockReturnValue(itemsChain);

    await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    expect(mockFrom).toHaveBeenCalledWith('activity_feed_items');
    expect(itemsChain.eq).toHaveBeenCalledWith('org_id', ORG_ID_FEED);
    expect(itemsChain.eq).toHaveBeenCalledWith('recipient_profile_id', PROFILE_ID);
    expect(itemsChain.is).toHaveBeenCalledWith('deleted_at', null);
    expect(itemsChain.order).toHaveBeenCalledWith('occurred_at', { ascending: false });
  });

  it('returns empty sections and zero unreadCount when there are no items', async () => {
    const chain = createReturnsChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    expect(result.sections).toEqual([]);
    expect(result.unreadCount).toBe(0);
    expect(result.activeTab).toBe('all');
    expect(result.tabs).toHaveLength(4);
  });

  it('maps a leaf item into the correct section', async () => {
    const chain = createReturnsChain({ data: [leafRow], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]!.label).toBe('Today');
    expect(result.sections[0]!.items).toHaveLength(1);
    expect(result.sections[0]!.items[0]).toMatchObject({
      kind: 'leaf',
      ids: { id: 'item-1', orgId: ORG_ID_FEED },
      tabKey: 'classes',
      verb: 'summary.posted',
      content: { headline: { primary: 'Priya posted a session summary' } },
      state: { isRead: false },
    });
  });

  it('counts unread items correctly', async () => {
    const chain = createReturnsChain({ data: [leafRow], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    expect(result.unreadCount).toBe(1);
    const classesTab = result.tabs.find((t) => t.key === 'classes');
    expect(classesTab?.badgeCount).toBe(1);
    const allTab = result.tabs.find((t) => t.key === 'all');
    expect(allTab?.badgeCount).toBe(1);
  });

  it('does not query group_members when there are no group items', async () => {
    const chain = createReturnsChain({ data: [leafRow], error: null });
    mockFrom.mockReturnValue(chain);

    await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    const queriedTables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(queriedTables).not.toContain('activity_feed_group_members');
  });

  it('attaches sub-activities to group items and removes them from top level', async () => {
    const itemsChain = createReturnsChain({ data: [leafRow, groupRow], error: null });
    const membersChain = createReturnsChain({ data: [memberRow1], error: null });
    mockFrom
      .mockReturnValueOnce(itemsChain) // activity_feed_items
      .mockReturnValueOnce(membersChain); // activity_feed_group_members

    const result = await fetchActivityFeed(ORG_ID_FEED, PROFILE_ID);

    const topLevelItems = result.sections.flatMap((s) => s.items);
    // leaf (item-1) is a member of group (item-2), so only the group appears at top level
    expect(topLevelItems).toHaveLength(1);
    expect(topLevelItems[0]!.kind).toBe('group');
    expect(topLevelItems[0]!.ids.id).toBe('item-2');

    const groupItem = topLevelItems[0] as { subActivities?: { items: unknown[] } };
    expect(groupItem.subActivities?.items).toHaveLength(1);
  });

  it('throws when activity_feed_items query returns an error', async () => {
    const dbError = new Error('DB error');
    const chain = createReturnsChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    await expect(fetchActivityFeed(ORG_ID_FEED, PROFILE_ID)).rejects.toThrow('DB error');
  });
});

// ─── toggleReaction ────────────────────────────────────────────────────────────

function createMaybeSingleChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.select = jest.fn(returnChain);
  chain.eq = jest.fn(returnChain);
  chain.is = jest.fn(returnChain);
  chain.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

// Thenable chain: all builder methods return self; awaiting the chain resolves
// with resolvedValue. Handles DML operations (insert/update/delete) with any
// number of chained .eq() calls.
function createThenableChain(resolvedValue: { error: unknown } = { error: null }) {
  type ThenableChain = {
    delete: jest.Mock<ThenableChain, []>;
    insert: jest.Mock<ThenableChain, []>;
    update: jest.Mock<ThenableChain, []>;
    eq: jest.Mock<ThenableChain, []>;
    is: jest.Mock<ThenableChain, []>;
    then: PromiseLike<{ error: unknown }>['then'];
  };
  const chain = {} as ThenableChain;
  const returnChain = () => chain;
  chain.delete = jest.fn(returnChain);
  chain.insert = jest.fn(returnChain);
  chain.update = jest.fn(returnChain);
  chain.eq = jest.fn(returnChain);
  chain.is = jest.fn(returnChain);
  chain.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolvedValue).then(resolve, reject);
  return chain;
}

const MSG_ID = 'msg-1';
const ACCOUNT_ID = 'acct-1';
const EMOJI = '👍';
const ORG = 'org-1';

describe('toggleReaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a reaction and inserts a new count row when no count row exists', async () => {
    const noExistingReaction = createMaybeSingleChain({ data: null, error: null });
    const noExistingCount = createMaybeSingleChain({ data: null, error: null });

    const insertReactionChain = createThenableChain();
    const insertCountChain = createThenableChain();

    mockFrom
      .mockReturnValueOnce(noExistingReaction) // message_reactions select
      .mockReturnValueOnce(noExistingCount) // message_reaction_counts select
      .mockReturnValueOnce(insertReactionChain) // message_reactions insert
      .mockReturnValueOnce(insertCountChain); // message_reaction_counts insert

    await toggleReaction(MSG_ID, ACCOUNT_ID, EMOJI, ORG);

    expect(insertReactionChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: MSG_ID,
        account_id: ACCOUNT_ID,
        emoji: EMOJI,
        org_id: ORG,
      }),
    );
    expect(insertCountChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: MSG_ID,
        emoji: EMOJI,
        org_id: ORG,
        count: 1,
      }),
    );
  });

  it('adds a reaction and increments an existing count row', async () => {
    const noExistingReaction = createMaybeSingleChain({ data: null, error: null });
    const existingCount = createMaybeSingleChain({
      data: { id: 'cnt-1', count: 3 },
      error: null,
    });

    const insertReactionChain = createThenableChain();
    const updateCountChain = createThenableChain();

    mockFrom
      .mockReturnValueOnce(noExistingReaction)
      .mockReturnValueOnce(existingCount)
      .mockReturnValueOnce(insertReactionChain)
      .mockReturnValueOnce(updateCountChain);

    await toggleReaction(MSG_ID, ACCOUNT_ID, EMOJI, ORG);

    expect(insertReactionChain.insert).toHaveBeenCalled();
    expect(updateCountChain.update).toHaveBeenCalledWith({ count: 4 });
  });

  it('removes a reaction and decrements the count row', async () => {
    const existingReaction = createMaybeSingleChain({
      data: { id: 'rxn-1' },
      error: null,
    });
    const existingCount = createMaybeSingleChain({
      data: { id: 'cnt-1', count: 3 },
      error: null,
    });

    const deleteReactionChain = createThenableChain();
    const updateCountChain = createThenableChain();

    mockFrom
      .mockReturnValueOnce(existingReaction)
      .mockReturnValueOnce(existingCount)
      .mockReturnValueOnce(deleteReactionChain)
      .mockReturnValueOnce(updateCountChain);

    await toggleReaction(MSG_ID, ACCOUNT_ID, EMOJI, ORG);

    expect(deleteReactionChain.delete).toHaveBeenCalled();
    expect(updateCountChain.update).toHaveBeenCalledWith({ count: 2 });
  });

  it('removes a reaction and deletes the count row when count is 1', async () => {
    const existingReaction = createMaybeSingleChain({
      data: { id: 'rxn-1' },
      error: null,
    });
    const existingCount = createMaybeSingleChain({
      data: { id: 'cnt-1', count: 1 },
      error: null,
    });

    const deleteReactionChain = createThenableChain();
    const deleteCountChain = createThenableChain();

    mockFrom
      .mockReturnValueOnce(existingReaction)
      .mockReturnValueOnce(existingCount)
      .mockReturnValueOnce(deleteReactionChain)
      .mockReturnValueOnce(deleteCountChain);

    await toggleReaction(MSG_ID, ACCOUNT_ID, EMOJI, ORG);

    expect(deleteReactionChain.delete).toHaveBeenCalled();
    expect(deleteCountChain.delete).toHaveBeenCalled();
  });
});

// ─── fetchSupervisedDirectMessages ─────────────────────────────────────────────

// Chain that terminates at .is() (used by most supervised query steps)
function createIsChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.select = jest.fn(returnChain);
  chain.eq = jest.fn(returnChain);
  chain.in = jest.fn(returnChain);
  chain.order = jest.fn(returnChain);
  chain.is = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

// Chain that terminates at .order() with .in() support (used by channels query)
function createOrderChainWithIn(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.select = jest.fn(returnChain);
  chain.eq = jest.fn(returnChain);
  chain.in = jest.fn(returnChain);
  chain.is = jest.fn(returnChain);
  chain.order = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

const SUP_ORG = 'org-sup-1';
const GUARDIAN_ACCOUNT_ID = 'acct-guardian-1';
const GUARDIAN_PROFILE_ID = 'prof-guardian-1';
const CHILD_ACCOUNT_ID = 'acct-child-1';
const CHILD_PROFILE_ID = 'prof-child-1';

describe('fetchSupervisedDirectMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns [] when family_links has no rows', async () => {
    // Step 1: family_links → empty
    mockFrom.mockReturnValueOnce(createIsChain({ data: [], error: null }));

    const result = await fetchSupervisedDirectMessages(
      SUP_ORG,
      GUARDIAN_ACCOUNT_ID,
      GUARDIAN_PROFILE_ID,
    );
    expect(result).toEqual([]);
  });

  it('returns [] when any required param is empty', async () => {
    const result = await fetchSupervisedDirectMessages(
      '',
      GUARDIAN_ACCOUNT_ID,
      GUARDIAN_PROFILE_ID,
    );
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns [] when child has no DM channels', async () => {
    // family_links
    mockFrom.mockReturnValueOnce(
      createIsChain({ data: [{ child_account_id: CHILD_ACCOUNT_ID }], error: null }),
    );
    // child profiles
    mockFrom.mockReturnValueOnce(
      createIsChain({
        data: [
          {
            id: CHILD_PROFILE_ID,
            display_name: 'Alice',
            first_name: null,
            last_name: null,
            account_id: CHILD_ACCOUNT_ID,
          },
        ],
        error: null,
      }),
    );
    // guardian memberships
    mockFrom.mockReturnValueOnce(createIsChain({ data: [], error: null }));
    // child memberships → no channels
    mockFrom.mockReturnValueOnce(createIsChain({ data: [], error: null }));

    const result = await fetchSupervisedDirectMessages(
      SUP_ORG,
      GUARDIAN_ACCOUNT_ID,
      GUARDIAN_PROFILE_ID,
    );
    expect(result).toEqual([]);
  });

  it('excludes channels where guardian is already a member', async () => {
    const SHARED_CH = 'ch-shared';
    // family_links
    mockFrom.mockReturnValueOnce(
      createIsChain({ data: [{ child_account_id: CHILD_ACCOUNT_ID }], error: null }),
    );
    // child profiles
    mockFrom.mockReturnValueOnce(
      createIsChain({
        data: [
          {
            id: CHILD_PROFILE_ID,
            display_name: 'Alice',
            first_name: null,
            last_name: null,
            account_id: CHILD_ACCOUNT_ID,
          },
        ],
        error: null,
      }),
    );
    // guardian memberships — guardian is already in SHARED_CH
    mockFrom.mockReturnValueOnce(
      createIsChain({ data: [{ channel_id: SHARED_CH }], error: null }),
    );
    // child memberships — only the shared channel
    mockFrom.mockReturnValueOnce(
      createIsChain({ data: [{ channel_id: SHARED_CH }], error: null }),
    );
    // childOnlyChannelIds would be empty after exclusion → no more calls

    const result = await fetchSupervisedDirectMessages(
      SUP_ORG,
      GUARDIAN_ACCOUNT_ID,
      GUARDIAN_PROFILE_ID,
    );
    expect(result).toEqual([]);
  });

  it('returns supervised channel with is_supervised=true and supervised_child_name', async () => {
    const SUPERVISED_CH = 'ch-supervised-1';
    // family_links
    mockFrom.mockReturnValueOnce(
      createIsChain({ data: [{ child_account_id: CHILD_ACCOUNT_ID }], error: null }),
    );
    // child profiles
    mockFrom.mockReturnValueOnce(
      createIsChain({
        data: [
          {
            id: CHILD_PROFILE_ID,
            display_name: 'Alice',
            first_name: null,
            last_name: null,
            account_id: CHILD_ACCOUNT_ID,
          },
        ],
        error: null,
      }),
    );
    // guardian memberships — guardian is NOT in supervised channel
    mockFrom.mockReturnValueOnce(createIsChain({ data: [], error: null }));
    // child memberships
    mockFrom.mockReturnValueOnce(
      createIsChain({ data: [{ channel_id: SUPERVISED_CH }], error: null }),
    );
    // channels fetch — terminates at .order()
    mockFrom.mockReturnValueOnce(
      createOrderChainWithIn({
        data: [
          {
            id: SUPERVISED_CH,
            org_id: SUP_ORG,
            topic: null,
            description: null,
            kind: 'dm',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    );
    // child read state
    mockFrom.mockReturnValueOnce(
      createIsChain({
        data: [{ channel_id: SUPERVISED_CH, unread_count: 0 }],
        error: null,
      }),
    );
    // member rows for participant display
    mockFrom.mockReturnValueOnce(
      createIsChain({
        data: [
          {
            channel_id: SUPERVISED_CH,
            profile_id: 'prof-teacher-1',
            profile: {
              id: 'prof-teacher-1',
              display_name: 'Ms Smith',
              first_name: null,
              last_name: null,
              avatar_url: null,
              avatar_seed: null,
            },
          },
          {
            channel_id: SUPERVISED_CH,
            profile_id: CHILD_PROFILE_ID,
            profile: {
              id: CHILD_PROFILE_ID,
              display_name: 'Alice',
              first_name: null,
              last_name: null,
              avatar_url: null,
              avatar_seed: null,
            },
          },
        ],
        error: null,
      }),
    );

    const result = await fetchSupervisedDirectMessages(
      SUP_ORG,
      GUARDIAN_ACCOUNT_ID,
      GUARDIAN_PROFILE_ID,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(SUPERVISED_CH);
    expect(result[0]!.is_supervised).toBe(true);
    expect(result[0]!.supervised_child_name).toBe('Alice');
    // Child's own profile excluded from participants; only the teacher remains
    expect(result[0]!.participants).toHaveLength(1);
    expect(result[0]!.participants![0]!.id).toBe('prof-teacher-1');
  });

  it('deduplicates when two children share a supervised channel', async () => {
    const SUPERVISED_CH = 'ch-shared-children';
    const CHILD_2_ACCOUNT_ID = 'acct-child-2';
    const CHILD_2_PROFILE_ID = 'prof-child-2';

    // family_links — two children
    mockFrom.mockReturnValueOnce(
      createIsChain({
        data: [
          { child_account_id: CHILD_ACCOUNT_ID },
          { child_account_id: CHILD_2_ACCOUNT_ID },
        ],
        error: null,
      }),
    );
    // child profiles — both children
    mockFrom.mockReturnValueOnce(
      createIsChain({
        data: [
          {
            id: CHILD_PROFILE_ID,
            display_name: 'Alice',
            first_name: null,
            last_name: null,
            account_id: CHILD_ACCOUNT_ID,
          },
          {
            id: CHILD_2_PROFILE_ID,
            display_name: 'Bob',
            first_name: null,
            last_name: null,
            account_id: CHILD_2_ACCOUNT_ID,
          },
        ],
        error: null,
      }),
    );
    // guardian memberships — not in supervised channel
    mockFrom.mockReturnValueOnce(createIsChain({ data: [], error: null }));

    // Child 1 memberships
    mockFrom.mockReturnValueOnce(
      createIsChain({ data: [{ channel_id: SUPERVISED_CH }], error: null }),
    );
    // channels fetch for child 1
    mockFrom.mockReturnValueOnce(
      createOrderChainWithIn({
        data: [
          {
            id: SUPERVISED_CH,
            org_id: SUP_ORG,
            topic: null,
            description: null,
            kind: 'dm',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    );
    // member rows for child 1
    mockFrom.mockReturnValueOnce(createIsChain({ data: [], error: null }));

    // Child 2 memberships — same channel
    mockFrom.mockReturnValueOnce(
      createIsChain({ data: [{ channel_id: SUPERVISED_CH }], error: null }),
    );
    // channels fetch for child 2
    mockFrom.mockReturnValueOnce(
      createOrderChainWithIn({
        data: [
          {
            id: SUPERVISED_CH,
            org_id: SUP_ORG,
            topic: null,
            description: null,
            kind: 'dm',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    );
    // member rows for child 2
    mockFrom.mockReturnValueOnce(createIsChain({ data: [], error: null }));

    const result = await fetchSupervisedDirectMessages(
      SUP_ORG,
      GUARDIAN_ACCOUNT_ID,
      GUARDIAN_PROFILE_ID,
    );
    // Should appear only once despite being found via two children
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(SUPERVISED_CH);
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
