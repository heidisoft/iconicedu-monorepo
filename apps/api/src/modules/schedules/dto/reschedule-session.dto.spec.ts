import { BadRequestException } from '@nestjs/common';
import { parseRescheduleSessionDto } from './reschedule-session.dto';

function validBody(overrides?: Record<string, unknown>) {
  return {
    orgId: 'org-1',
    scheduleId: 'schedule-1',
    occurrenceKey: null,
    startAt: '2026-09-22T14:00:00.000Z',
    endAt: '2026-09-22T15:00:00.000Z',
    timezone: 'UTC',
    reason: null,
    ...overrides,
  };
}

describe('parseRescheduleSessionDto', () => {
  it("defaults scope to 'occurrence' when omitted", () => {
    const dto = parseRescheduleSessionDto(validBody());
    expect(dto.scope).toBe('occurrence');
    expect(dto.byWeekday).toBeNull();
    expect(dto.confirmDropFutureOverrides).toBe(false);
  });

  it("requires exactly one byWeekday entry for scope 'all'", () => {
    expect(() =>
      parseRescheduleSessionDto(validBody({ scope: 'all', byWeekday: [] })),
    ).toThrow(BadRequestException);
    expect(() => parseRescheduleSessionDto(validBody({ scope: 'all' }))).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseRescheduleSessionDto(validBody({ scope: 'all', byWeekday: ['MO', 'TU'] })),
    ).toThrow(BadRequestException);
  });

  it('rejects a weekday token that is not a valid RRULE day', () => {
    expect(() =>
      parseRescheduleSessionDto(validBody({ scope: 'all', byWeekday: ['MONDAY'] })),
    ).toThrow(BadRequestException);
  });

  it("accepts scope 'all' with a single valid weekday", () => {
    const dto = parseRescheduleSessionDto(validBody({ scope: 'all', byWeekday: ['TU'] }));
    expect(dto.scope).toBe('all');
    expect(dto.byWeekday).toEqual(['TU']);
  });

  it('rejects an unknown scope value', () => {
    expect(() => parseRescheduleSessionDto(validBody({ scope: 'everything' }))).toThrow(
      BadRequestException,
    );
  });
});
