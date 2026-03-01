import { describe, expect, it } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import { expandRecurringEvents } from './class-schedule-utils';

function buildRecurringSchedule(): ClassScheduleVM {
  return {
    ids: { id: 'schedule-1', orgId: 'org-1' },
    title: 'Session',
    startAt: '2026-03-01T15:00:00.000Z',
    endAt: '2026-03-01T16:00:00.000Z',
    status: 'scheduled',
    visibility: 'private',
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    },
    recurrence: {
      ids: { id: 'recurrence-1', orgId: 'org-1' },
      rule: {
        frequency: 'daily',
        interval: 1,
        count: 2,
      },
      overrides: [
        {
          occurrenceKey: '2026-03-02T10:00:00.000Z',
          patch: {
            startAt: '2026-03-03T17:00:00.000Z',
            endAt: '2026-03-03T18:00:00.000Z',
          },
        },
      ],
    },
    audit: { createdAt: '2026-03-01T00:00:00.000Z', createdBy: 'user-1' },
  };
}

describe('class-schedule-utils', () => {
  it('matches overrides by occurrence day when timestamp keys differ', () => {
    const expanded = expandRecurringEvents(
      [buildRecurringSchedule()],
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-04T00:00:00.000Z'),
    );

    expect(expanded.map((item) => item.startAt)).toContain('2026-03-03T17:00:00.000Z');
  });
});
