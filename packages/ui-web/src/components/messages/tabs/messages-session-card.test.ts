import { describe, expect, it } from 'vitest';
import type { ClassSession } from './messages-schedule-tab.utils';
import {
  getSessionCardState,
  isSessionJoinButtonDisabled,
} from './messages-session-card';

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
      isDisabled: false,
    });
    expect(getSessionCardState({ ...baseSession, isToday: true, isPast: false })).toEqual({
      isLive: true,
      isPast: false,
      isDisabled: false,
    });
    expect(getSessionCardState({ ...baseSession, isToday: true, isPast: true })).toEqual({
      isLive: false,
      isPast: true,
      isDisabled: false,
    });
    expect(getSessionCardState({ ...baseSession, disabled: true })).toEqual({
      isLive: false,
      isPast: false,
      isDisabled: true,
    });
  });

  it('disables join only for unavailable states or when join handler is missing', () => {
    expect(
      isSessionJoinButtonDisabled({
        session: baseSession,
        hasJoinLiveSession: true,
        isJoinPending: false,
        canJoin: true,
      }),
    ).toBe(false);

    expect(
      isSessionJoinButtonDisabled({
        session: baseSession,
        hasJoinLiveSession: false,
        isJoinPending: false,
        canJoin: true,
      }),
    ).toBe(true);

    expect(
      isSessionJoinButtonDisabled({
        session: baseSession,
        hasJoinLiveSession: true,
        isJoinPending: false,
        canJoin: false,
      }),
    ).toBe(true);

    expect(
      isSessionJoinButtonDisabled({
        session: { ...baseSession, isPast: true },
        hasJoinLiveSession: true,
        isJoinPending: false,
        canJoin: true,
      }),
    ).toBe(true);

    expect(
      isSessionJoinButtonDisabled({
        session: { ...baseSession, disabled: true },
        hasJoinLiveSession: true,
        isJoinPending: false,
        canJoin: true,
      }),
    ).toBe(true);

    expect(
      isSessionJoinButtonDisabled({
        session: baseSession,
        hasJoinLiveSession: true,
        isJoinPending: true,
        canJoin: true,
      }),
    ).toBe(true);
  });
});
