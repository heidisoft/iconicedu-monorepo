import { describe, expect, it } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { formatScheduleDateBlockLabel } from './messages-schedule-tab';

function buildSchedule(startAt: string): ClassScheduleVM {
  return {
    ids: { id: 'schedule-1', orgId: 'org-1' },
    title: 'Session',
    startAt,
    endAt: new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    visibility: 'private',
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    },
    audit: { createdAt: startAt, createdBy: 'user-1' },
  };
}

describe('messages-schedule-tab', () => {
  it('formats weekday label for today cards', () => {
    const schedule = buildSchedule('2026-03-03T16:00:00.000Z');
    expect(formatScheduleDateBlockLabel(schedule)).toBe('Tue');
  });

  it('formats weekday label for non-today cards', () => {
    const schedule = buildSchedule('2026-03-04T16:00:00.000Z');
    expect(formatScheduleDateBlockLabel(schedule)).toBe('Wed');
  });
});
