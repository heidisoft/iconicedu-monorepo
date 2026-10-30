import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

const getScheduleCalendarMock = vi.fn();

vi.mock('@iconicedu/web/lib/api/schedules', () => ({
  getScheduleCalendar: (...args: unknown[]) => getScheduleCalendarMock(...args),
}));

import {
  buildClassScheduleById,
  buildClassSchedulesByIds,
  buildClassSchedulesByOrg,
} from './class-schedule.builder';

const supabase = {} as never;

function makeSchedule(id: string): ClassScheduleVM {
  return {
    ids: { id, orgId: 'org-1' },
    title: 'Algebra I',
    startAt: '2026-09-02T09:00:00.000Z',
    endAt: '2026-09-02T10:00:00.000Z',
    status: 'scheduled',
    visibility: 'private',
    participants: [],
    source: { kind: 'manual', createdByUserId: 'user-1' },
    audit: { createdAt: '2026-08-01T00:00:00.000Z', createdBy: 'user-1' },
  };
}

describe('class-schedule.builder', () => {
  beforeEach(() => {
    getScheduleCalendarMock.mockReset();
  });

  it('buildClassSchedulesByOrg calls the calendar endpoint with just orgId', async () => {
    const schedules = [makeSchedule('schedule-1')];
    getScheduleCalendarMock.mockResolvedValue(schedules);

    const result = await buildClassSchedulesByOrg(supabase, 'org-1');

    expect(getScheduleCalendarMock).toHaveBeenCalledWith(supabase, { orgId: 'org-1' });
    expect(result).toBe(schedules);
  });

  it('buildClassSchedulesByIds calls the calendar endpoint with scheduleIds', async () => {
    const schedules = [makeSchedule('schedule-1'), makeSchedule('schedule-2')];
    getScheduleCalendarMock.mockResolvedValue(schedules);

    const result = await buildClassSchedulesByIds(supabase, 'org-1', [
      'schedule-1',
      'schedule-2',
    ]);

    expect(getScheduleCalendarMock).toHaveBeenCalledWith(supabase, {
      orgId: 'org-1',
      scheduleIds: ['schedule-1', 'schedule-2'],
    });
    expect(result).toBe(schedules);
  });

  it('buildClassSchedulesByIds short-circuits without calling the API for an empty list', async () => {
    const result = await buildClassSchedulesByIds(supabase, 'org-1', []);

    expect(result).toEqual([]);
    expect(getScheduleCalendarMock).not.toHaveBeenCalled();
  });

  it('buildClassScheduleById returns the first matching schedule', async () => {
    const schedule = makeSchedule('schedule-1');
    getScheduleCalendarMock.mockResolvedValue([schedule]);

    const result = await buildClassScheduleById(supabase, 'org-1', 'schedule-1');

    expect(getScheduleCalendarMock).toHaveBeenCalledWith(supabase, {
      orgId: 'org-1',
      scheduleIds: ['schedule-1'],
    });
    expect(result).toBe(schedule);
  });

  it('buildClassScheduleById returns null when nothing is found', async () => {
    getScheduleCalendarMock.mockResolvedValue([]);

    const result = await buildClassScheduleById(supabase, 'org-1', 'missing-schedule');

    expect(result).toBeNull();
  });
});
