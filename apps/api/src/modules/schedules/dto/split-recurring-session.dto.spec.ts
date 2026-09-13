import { BadRequestException } from '@nestjs/common';
import { parseSplitRecurringSessionDto } from './split-recurring-session.dto';

function validBody(overrides?: Record<string, unknown>) {
  return {
    orgId: 'org-1',
    scheduleId: 'schedule-1',
    occurrenceKey: '2026-09-23T09:10:00.000Z',
    newStartAt: '2026-09-22T14:00:00.000Z',
    newEndAt: '2026-09-22T15:00:00.000Z',
    timezone: null,
    byWeekday: ['TU'],
    reason: null,
    ...overrides,
  };
}

describe('parseSplitRecurringSessionDto', () => {
  it('parses a valid body, defaulting confirmDropFutureOverrides to false', () => {
    expect(parseSplitRecurringSessionDto(validBody())).toEqual({
      orgId: 'org-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-09-23T09:10:00.000Z',
      newStartAt: '2026-09-22T14:00:00.000Z',
      newEndAt: '2026-09-22T15:00:00.000Z',
      timezone: null,
      byWeekday: ['TU'],
      reason: null,
      suppressNotifications: false,
      confirmDropFutureOverrides: false,
    });
  });

  it('rejects an empty byWeekday array', () => {
    expect(() => parseSplitRecurringSessionDto(validBody({ byWeekday: [] }))).toThrow(
      BadRequestException,
    );
  });

  it('rejects more than one weekday (v1 is single-weekday only)', () => {
    expect(() =>
      parseSplitRecurringSessionDto(validBody({ byWeekday: ['MO', 'TU'] })),
    ).toThrow(BadRequestException);
  });

  it('rejects a weekday token that is not a valid RRULE day', () => {
    expect(() =>
      parseSplitRecurringSessionDto(validBody({ byWeekday: ['MONDAY'] })),
    ).toThrow(BadRequestException);
  });
});
