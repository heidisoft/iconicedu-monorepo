import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./scheduling/expand-recurring-events', () => ({
  expandRecurringEvents: vi.fn(),
}));

vi.mock('./scheduling/class-schedule.builder', () => ({
  buildClassSchedulesByOrg: vi.fn(),
}));

import { expandRecurringEvents } from './scheduling/expand-recurring-events';
import { buildClassSchedulesByOrg } from './scheduling/class-schedule.builder';
import { resolveChannelLiveSessionScope } from './scope';

describe('resolveChannelLiveSessionScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the scheduled occurrence when the join is within the session window', async () => {
    vi.mocked(buildClassSchedulesByOrg).mockResolvedValue([
      {
        id: 'schedule-1',
        title: 'ELA with Mr Daniel',
        source: {
          kind: 'class_session',
          channelId: 'channel-1',
        },
      },
    ] as never);

    vi.mocked(expandRecurringEvents).mockReturnValue([
      {
        scheduleId: 'schedule-1',
        startAt: '2026-03-19T16:00:00.000Z',
        endAt: '2026-03-19T17:00:00.000Z',
      },
      {
        scheduleId: 'schedule-1',
        startAt: '2026-03-20T16:00:00.000Z',
        endAt: '2026-03-20T17:00:00.000Z',
      },
    ] as never);

    const scope = await resolveChannelLiveSessionScope({
      supabase: {} as never,
      orgId: 'org-1',
      channelId: 'channel-1',
      now: new Date('2026-03-19T17:20:00.000Z'),
    });

    expect(scope).toMatchObject({
      scopeKey: 'occurrence:2026-03-19T16:00:00.000Z',
      occurrenceKey: '2026-03-19T16:00:00.000Z',
      occurrenceEndAt: '2026-03-19T17:00:00.000Z',
      occurrenceLabel: expect.stringContaining('ELA with Mr Daniel'),
      isScheduledSessionWindow: true,
    });
  });

  it('uses the scheduled occurrence when the join is within the 15 minute early allowance', async () => {
    vi.mocked(buildClassSchedulesByOrg).mockResolvedValue([
      {
        id: 'schedule-1',
        title: 'ELA with Mr Daniel',
        source: {
          kind: 'class_session',
          channelId: 'channel-1',
        },
      },
    ] as never);

    vi.mocked(expandRecurringEvents).mockReturnValue([
      {
        scheduleId: 'schedule-1',
        startAt: '2026-03-19T16:00:00.000Z',
        endAt: '2026-03-19T17:00:00.000Z',
      },
      {
        scheduleId: 'schedule-1',
        startAt: '2026-03-20T16:00:00.000Z',
        endAt: '2026-03-20T17:00:00.000Z',
      },
    ] as never);

    const scope = await resolveChannelLiveSessionScope({
      supabase: {} as never,
      orgId: 'org-1',
      channelId: 'channel-1',
      now: new Date('2026-03-19T15:50:00.000Z'),
    });

    expect(scope).toMatchObject({
      scopeKey: 'occurrence:2026-03-19T16:00:00.000Z',
      occurrenceKey: '2026-03-19T16:00:00.000Z',
      occurrenceEndAt: '2026-03-19T17:00:00.000Z',
      isScheduledSessionWindow: true,
    });
  });

  it('falls back to channel-scoped huddle grouping when outside the session window', async () => {
    vi.mocked(buildClassSchedulesByOrg).mockResolvedValue([
      {
        id: 'schedule-1',
        title: 'ELA with Mr Daniel',
        source: {
          kind: 'class_session',
          channelId: 'channel-1',
        },
      },
    ] as never);

    vi.mocked(expandRecurringEvents).mockReturnValue([
      {
        scheduleId: 'schedule-1',
        startAt: '2026-03-19T16:00:00.000Z',
        endAt: '2026-03-19T17:00:00.000Z',
      },
      {
        scheduleId: 'schedule-1',
        startAt: '2026-03-20T16:00:00.000Z',
        endAt: '2026-03-20T17:00:00.000Z',
      },
    ] as never);

    const scope = await resolveChannelLiveSessionScope({
      supabase: {} as never,
      orgId: 'org-1',
      channelId: 'channel-1',
      now: new Date('2026-03-19T15:30:00.000Z'),
    });

    expect(scope).toMatchObject({
      scopeKey: 'channel:channel-1',
      occurrenceKey: null,
      occurrenceEndAt: null,
      occurrenceLabel: null,
      schedule: null,
      isScheduledSessionWindow: false,
    });
  });
});

describe('strict classroom calling scope', () => {
  it.each([
    ['before', '2026-11-03T14:59:59.999Z', 'scheduled', false],
    ['start', '2026-11-03T15:00:00.000Z', 'scheduled', true],
    ['during', '2026-11-03T15:30:00.000Z', 'scheduled', true],
    ['end', '2026-11-03T16:00:00.000Z', 'scheduled', false],
    ['cancelled', '2026-11-03T15:30:00.000Z', 'cancelled', false],
  ])(
    'uses no grace or cancelled occurrences: %s',
    async (_label, now, status, allowed) => {
      vi.mocked(buildClassSchedulesByOrg).mockResolvedValue([
        {
          ids: { id: 'schedule' },
          title: 'Test class',
          source: { kind: 'class_session', channelId: 'channel' },
        },
      ] as never);
      vi.mocked(expandRecurringEvents).mockReturnValue([
        {
          startAt: '2026-11-03T15:00:00.000Z',
          endAt: '2026-11-03T16:00:00.000Z',
          status,
        },
      ] as never);
      const result = await resolveChannelLiveSessionScope({
        supabase: {} as never,
        orgId: 'org',
        channelId: 'channel',
        now: new Date(now),
        strictClassTime: true,
      });
      expect(!!result.schedule).toBe(allowed);
    },
  );
});

it('uses the live session’s own schedule when class windows overlap', async () => {
  vi.mocked(buildClassSchedulesByOrg).mockResolvedValue([
    { ids: { id: 'other' }, source: { kind: 'class_session', channelId: 'channel' } },
    { ids: { id: 'target' }, source: { kind: 'class_session', channelId: 'channel' } },
  ] as never);
  vi.mocked(expandRecurringEvents).mockReturnValue([
    {
      startAt: '2026-11-03T15:00:00Z',
      endAt: '2026-11-03T16:00:00Z',
      status: 'scheduled',
    },
  ] as never);
  const result = await resolveChannelLiveSessionScope({
    supabase: {} as never,
    orgId: 'org',
    channelId: 'channel',
    now: new Date('2026-11-03T15:30:00Z'),
    strictClassTime: true,
    scheduleId: 'target',
    occurrenceKey: '2026-11-03T15:00:00Z',
  });
  expect(result.schedule?.ids.id).toBe('target');
});
