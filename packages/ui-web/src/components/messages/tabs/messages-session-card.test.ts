import { describe, expect, it } from 'vitest';
import type { ClassSession } from './messages-schedule-tab.utils';
import { getSessionCardState } from './messages-session-card';

const baseSession: ClassSession = {
  id: 'session-1',
  label: 'Mar · Week 1',
  time: '4:00 PM',
  dayName: 'Tue',
  dayNum: '3',
  isToday: false,
  isPast: false,
  status: 'scheduled',
  meetingLink: null,
};

describe('messages-session-card', () => {
  it('marks sessions as live only when today and not past', () => {
    expect(getSessionCardState({ ...baseSession, isToday: false, isPast: false })).toEqual({
      isLive: false,
      isPast: false,
    });
    expect(getSessionCardState({ ...baseSession, isToday: true, isPast: false })).toEqual({
      isLive: true,
      isPast: false,
    });
    expect(getSessionCardState({ ...baseSession, isToday: true, isPast: true })).toEqual({
      isLive: false,
      isPast: true,
    });
  });
});
