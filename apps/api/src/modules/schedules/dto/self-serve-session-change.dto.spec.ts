import { BadRequestException } from '@nestjs/common';
import {
  parseDecideSessionChangeRequestDto,
  parseSelfServeCancelSessionDto,
  parseSelfServeRescheduleSessionDto,
} from '@iconicedu/api/modules/schedules/dto/self-serve-session-change.dto';

describe('self-serve session change DTOs', () => {
  it('parses cancel requests with optional occurrence and note', () => {
    expect(
      parseSelfServeCancelSessionDto({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2030-03-06T10:00:00.000Z',
        note: 'Family conflict',
      }),
    ).toEqual({
      orgId: 'org-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2030-03-06T10:00:00.000Z',
      note: 'Family conflict',
    });
  });

  it('requires reschedule start and end times', () => {
    expect(() =>
      parseSelfServeRescheduleSessionDto({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        startAt: '2030-03-06T10:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('parses decision notes', () => {
    expect(parseDecideSessionChangeRequestDto({ note: 'Approved' })).toEqual({
      note: 'Approved',
    });
  });
});
