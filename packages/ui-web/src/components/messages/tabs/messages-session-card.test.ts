import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ClassSession } from './messages-schedule-tab.utils';
import {
  getSessionCardState,
  isSessionJoinButtonDisabled,
  SessionCard,
} from './messages-session-card';

const baseSession: ClassSession = {
  id: 'session-1',
  label: 'Mar · Week 1 · Session 1',
  time: 'Tue 4:00pm',
  dayName: 'Tue',
  dayNum: '3',
  isToday: false,
  isLive: false,
  isPast: false,
  endAt: '2026-03-03T17:00:00.000Z',
  status: 'scheduled',
  meetingLink: null,
};

describe('messages-session-card', () => {
  it('renders a plain card with no classroom accent bar', () => {
    render(
      React.createElement(SessionCard, {
        session: { ...baseSession, themeKey: 'violet' },
        index: 0,
      }),
    );

    const tile = document.querySelector('[data-classroom-theme="violet"]');
    expect(tile).not.toHaveClass('theme-violet');
    expect(tile).toHaveClass('bg-card');
    expect(screen.queryByTestId('session-accent-edge')).toBeNull();
  });

  it('marks sessions as live only when currently active and not past', () => {
    expect(getSessionCardState({ ...baseSession, isLive: false, isPast: false })).toEqual(
      {
        isLive: false,
        isPast: false,
        isDisabled: false,
      },
    );
    expect(getSessionCardState({ ...baseSession, isLive: true, isPast: false })).toEqual({
      isLive: true,
      isPast: false,
      isDisabled: false,
    });
    expect(getSessionCardState({ ...baseSession, isLive: true, isPast: true })).toEqual({
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
        hasJoinAction: true,
        isJoinPending: false,
        canJoin: true,
      }),
    ).toBe(false);

    expect(
      isSessionJoinButtonDisabled({
        session: baseSession,
        hasJoinAction: false,
        isJoinPending: false,
        canJoin: true,
      }),
    ).toBe(true);

    expect(
      isSessionJoinButtonDisabled({
        session: baseSession,
        hasJoinAction: true,
        isJoinPending: false,
        canJoin: false,
      }),
    ).toBe(true);

    expect(
      isSessionJoinButtonDisabled({
        session: { ...baseSession, isPast: true },
        hasJoinAction: true,
        isJoinPending: false,
        canJoin: true,
      }),
    ).toBe(true);

    expect(
      isSessionJoinButtonDisabled({
        session: { ...baseSession, disabled: true },
        hasJoinAction: true,
        isJoinPending: false,
        canJoin: true,
      }),
    ).toBe(true);

    expect(
      isSessionJoinButtonDisabled({
        session: baseSession,
        hasJoinAction: true,
        isJoinPending: true,
        canJoin: true,
      }),
    ).toBe(true);
  });

  it('renders join before message when actionOrder is join-first', () => {
    render(
      React.createElement(SessionCard, {
        session: baseSession,
        index: 0,
        canJoin: true,
        actionOrder: 'join-first',
        joinLiveSession: async () => {},
        classroomChatHref: '/iconic-academy/s/channel-1',
      }),
    );

    const joinButton = screen.getByRole('button', { name: /Join/i });
    const messageButton = screen.getByRole('button', { name: 'Message' });

    expect(
      joinButton.compareDocumentPosition(messageButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('opens the existing session link for a read-only staff tile without calling the role-sensitive handler', async () => {
    const joinLiveSession = vi.fn(async () => {});
    const user = userEvent.setup();

    render(
      React.createElement(SessionCard, {
        session: {
          ...baseSession,
          meetingLink: 'https://meet.google.com/staff-session',
        },
        index: 0,
        canJoin: true,
        joinLiveSession,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Join' }));

    expect(screen.getByText('Session ready to join')).toBeInTheDocument();
    expect(screen.getByText('https://meet.google.com/staff-session')).toBeInTheDocument();
    expect(joinLiveSession).not.toHaveBeenCalled();
  });

  it('enables join on the occurrence meeting link alone', async () => {
    const user = userEvent.setup();

    render(
      React.createElement(SessionCard, {
        session: {
          ...baseSession,
          meetingLink: 'https://meet.google.com/staff-session',
        },
        index: 0,
        canJoin: true,
      }),
    );

    const joinButton = screen.getByRole('button', { name: 'Join' });
    expect(joinButton).toBeEnabled();

    await user.click(joinButton);

    expect(screen.getByText('https://meet.google.com/staff-session')).toBeInTheDocument();
  });

  it('calls the join handler before the configured link when the occurrence has no meeting link', async () => {
    const joinLiveSession = vi.fn(async () => {});
    const user = userEvent.setup();

    render(
      React.createElement(SessionCard, {
        session: baseSession,
        index: 0,
        canJoin: true,
        joinLiveSession,
        joinHref: 'https://meet.google.com/channel-fallback',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Join' }));

    expect(joinLiveSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Session ready to join')).toBeNull();
    expect(screen.queryByText('https://meet.google.com/channel-fallback')).toBeNull();
  });

  it('falls back to the configured link when there is no meeting link or handler', async () => {
    const user = userEvent.setup();

    render(
      React.createElement(SessionCard, {
        session: baseSession,
        index: 0,
        canJoin: true,
        joinHref: 'https://meet.google.com/channel-fallback',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Join' }));

    expect(
      screen.getByText('https://meet.google.com/channel-fallback'),
    ).toBeInTheDocument();
  });
});
