import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@iconicedu/ui-web/lib/class-schedule-utils', () => ({
  expandRecurringEvents: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/schedules/builders/class-schedule.builder', () => ({
  buildClassSchedulesByOrg: vi.fn(),
}));

import { expandRecurringEvents } from '@iconicedu/ui-web/lib/class-schedule-utils';
import { buildClassSchedulesByOrg } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';
import { resolveChannelLiveSessionScope } from '@iconicedu/web/lib/live-sessions/scope';

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
