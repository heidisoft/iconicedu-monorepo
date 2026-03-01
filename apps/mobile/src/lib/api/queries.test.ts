import { fetchSpaceSchedulesByChannelId, queryKeys } from './queries';

// ─── Supabase mock ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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
    expect(result[0]!.recurrence!.exceptions![0]!.occurrenceKey).toBe('2026-03-09T10:00:00Z');
    expect(result[0]!.recurrence!.exceptions![0]!.reason).toBe('Holiday');
    expect(result[0]!.recurrence!.overrides).toHaveLength(0);
  });

  it('maps multiple participants', async () => {
    const rowWithParticipants = {
      ...minimalRow,
      participants: [
        { id: 'p-1', org_id: ORG_ID, role: 'teacher', status: 'accepted', display_name: 'Ms Smith', avatar_url: null, theme_key: null },
        { id: 'p-2', org_id: ORG_ID, role: 'student', status: 'pending', display_name: 'Jane', avatar_url: 'https://img/a.png', theme_key: 'teal' },
      ],
    };
    const chain = createQueryChain({ data: [rowWithParticipants], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID);

    expect(result[0]!.participants).toHaveLength(2);
    expect(result[0]!.participants[0]).toMatchObject({ ids: { id: 'p-1' }, role: 'teacher', displayName: 'Ms Smith' });
    expect(result[0]!.participants[1]).toMatchObject({ ids: { id: 'p-2' }, role: 'student', avatarUrl: 'https://img/a.png', themeKey: 'teal' });
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

    await expect(
      fetchSpaceSchedulesByChannelId(CHANNEL_ID, ORG_ID),
    ).rejects.toThrow('Connection refused');
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
