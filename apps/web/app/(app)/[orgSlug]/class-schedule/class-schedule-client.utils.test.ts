import { describe, expect, it } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import {
  applyCancelledSessionToSchedules,
  applyUpdatedSessionToSchedules,
  getBaseScheduleId,
  getEventOccurrenceKey,
} from './class-schedule-client.utils';

function buildSchedule(overrides?: Partial<ClassScheduleVM>): ClassScheduleVM {
  return {
    ids: { id: 'schedule-1', orgId: 'org-1' },
    title: 'Algebra',
    startAt: '2026-03-21T10:00:00.000Z',
    endAt: '2026-03-21T11:00:00.000Z',
    status: 'scheduled',
    visibility: 'class-members',
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    },
    recurrence: {
      ids: { id: 'recurrence-1', orgId: 'org-1' },
      rule: { frequency: 'weekly', timezone: 'America/New_York' },
      exceptions: [{ occurrenceKey: '2026-03-14T10:00:00.000Z', reason: 'Holiday' }],
      overrides: [
        {
          occurrenceKey: '2026-03-21T10:00:00.000Z',
          patch: {
            startAt: '2026-03-21T12:00:00.000Z',
            endAt: '2026-03-21T13:00:00.000Z',
          },
        },
      ],
    },
    audit: {
      createdAt: '2026-03-01T00:00:00.000Z',
      createdBy: 'account-1',
    },
    ...overrides,
  };
}

describe('class-schedule-client utils', () => {
  it('strips composite display ids back to the base schedule id', () => {
    expect(getBaseScheduleId('schedule-1__2026-03-21T10:00:00.000Z')).toBe('schedule-1');
    expect(getBaseScheduleId('schedule-1')).toBe('schedule-1');
  });

  it('prefers original occurrence keys for rescheduled sessions', () => {
    expect(
      getEventOccurrenceKey({
        ...buildSchedule(),
        ids: { id: 'schedule-1__2026-03-21T10:00:00.000Z', orgId: 'org-1' },
        startAt: '2026-03-21T12:00:00.000Z',
        endAt: '2026-03-21T13:00:00.000Z',
        uiState: {
          kind: 'override',
          originalStartAt: '2026-03-21T10:00:00.000Z',
        },
      }),
    ).toBe('2026-03-21T10:00:00.000Z');
  });

  it('adds a recurrence exception and removes the matching override after cancellation', () => {
    const schedules = [buildSchedule()];

    const result = applyCancelledSessionToSchedules(schedules, {
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: 'Tutor unavailable',
      mode: 'recurring',
    });

    expect(result[0]?.recurrence?.exceptions).toEqual([
      { occurrenceKey: '2026-03-14T10:00:00.000Z', reason: 'Holiday' },
      { occurrenceKey: '2026-03-21T10:00:00.000Z', reason: 'Tutor unavailable' },
    ]);
    expect(result[0]?.recurrence?.overrides).toBeUndefined();
  });

  it('marks single schedules as cancelled after cancellation', () => {
    const schedules = [buildSchedule({ recurrence: undefined })];

    const result = applyCancelledSessionToSchedules(schedules, {
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: null,
      mode: 'single',
    });

    expect(result[0]?.status).toBe('cancelled');
  });

  it('upserts a recurrence override after a recurring session edit', () => {
    const schedules = [buildSchedule()];

    const result = applyUpdatedSessionToSchedules(schedules, {
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      mode: 'recurring',
      status: 'rescheduled',
      startAt: '2026-03-22T14:00:00.000Z',
      endAt: '2026-03-22T15:30:00.000Z',
      timezone: 'America/New_York',
      reason: 'Moved to Sunday',
    });

    expect(result[0]?.recurrence?.exceptions).toEqual([
      { occurrenceKey: '2026-03-14T10:00:00.000Z', reason: 'Holiday' },
    ]);
    expect(result[0]?.recurrence?.overrides).toEqual([
      {
        occurrenceKey: '2026-03-21T10:00:00.000Z',
        patch: {
          startAt: '2026-03-22T14:00:00.000Z',
          endAt: '2026-03-22T15:30:00.000Z',
          reason: 'Moved to Sunday',
        },
      },
    ]);
  });

  it('removes a recurrence override when a recurring session is restored to its base timing', () => {
    const schedules = [buildSchedule()];

    const result = applyUpdatedSessionToSchedules(schedules, {
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      mode: 'recurring',
      status: 'scheduled',
      startAt: '2026-03-21T10:00:00.000Z',
      endAt: '2026-03-21T11:00:00.000Z',
      timezone: 'America/New_York',
      reason: null,
    });

    expect(result[0]?.recurrence?.overrides).toBeUndefined();
  });

  it('updates single schedules after an edit', () => {
    const schedules = [buildSchedule({ recurrence: undefined, timezone: 'UTC' })];

    const result = applyUpdatedSessionToSchedules(schedules, {
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      mode: 'single',
      status: 'scheduled',
      startAt: '2026-03-21T12:00:00.000Z',
      endAt: '2026-03-21T13:30:00.000Z',
      timezone: 'America/Chicago',
      reason: 'Updated',
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        startAt: '2026-03-21T12:00:00.000Z',
        endAt: '2026-03-21T13:30:00.000Z',
        timezone: 'America/Chicago',
        status: 'scheduled',
      }),
    );
  });
});
