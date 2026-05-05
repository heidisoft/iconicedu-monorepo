import { BadRequestException } from '@nestjs/common';

import { parseCancelSessionDto } from '@iconicedu/api/modules/schedules/dto/cancel-session.dto';
import { parseRescheduleSessionDto } from '@iconicedu/api/modules/schedules/dto/reschedule-session.dto';

describe('schedule session notification suppression DTOs', () => {
  it('defaults omitted suppression flags to false', () => {
    expect(
      parseCancelSessionDto({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
      }).suppressNotifications,
    ).toBe(false);
    expect(
      parseRescheduleSessionDto({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        startAt: '2026-03-22T14:00:00.000Z',
        endAt: '2026-03-22T15:00:00.000Z',
      }).suppressNotifications,
    ).toBe(false);
  });

  it('accepts boolean true suppression flags', () => {
    expect(
      parseCancelSessionDto({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        suppressNotifications: true,
      }).suppressNotifications,
    ).toBe(true);
    expect(
      parseRescheduleSessionDto({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        startAt: '2026-03-22T14:00:00.000Z',
        endAt: '2026-03-22T15:00:00.000Z',
        suppressNotifications: true,
      }).suppressNotifications,
    ).toBe(true);
  });

  it('rejects non-boolean suppression flags', () => {
    expect(() =>
      parseCancelSessionDto({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        suppressNotifications: 'true',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseRescheduleSessionDto({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        startAt: '2026-03-22T14:00:00.000Z',
        endAt: '2026-03-22T15:00:00.000Z',
        suppressNotifications: 'true',
      }),
    ).toThrow(BadRequestException);
  });
});
