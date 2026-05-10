import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MessageSquare } from 'lucide-react-native';

import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

import {
  ActivityItem,
  formatActivityPrimaryHeadline,
  makeActivityItemStyles,
} from './activity-item';
import { lightColors } from '@/lib/theme';

function makeBaseActivity(): ActivityFeedItemVM {
  return {
    kind: 'leaf',
    ids: { id: 'activity-1', orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-04-02T12:00:00.000Z',
      createdAt: '2026-04-02T12:00:00.000Z',
    },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'message.posted',
    refs: {
      actor: {
        kind: 'educator',
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
        profile: {
          displayName: 'Priya Sharma',
          firstName: 'Priya',
          lastName: 'Sharma',
          avatar: { source: 'seed', seed: 'priya-sharma' },
        },
        prefs: {},
        meta: {
          createdAt: '2026-04-02T12:00:00.000Z',
          updatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    },
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: {
        primary: 'Priya Sharma',
        secondary: 'sent a message in',
        emphasis: 'Math Foundations',
      },
      summary: 'A short preview',
    },
    state: { isRead: false, importance: 'normal' },
  } as ActivityFeedItemVM;
}

function renderActivity(
  item: ActivityFeedItemVM,
  overrides?: Partial<React.ComponentProps<typeof ActivityItem>>,
) {
  const onMarkRead = jest.fn();
  const onToggle = jest.fn();
  return render(
    <ActivityItem
      item={item}
      colors={lightColors}
      isDark={false}
      s={makeActivityItemStyles(lightColors)}
      onMarkRead={onMarkRead}
      expandedIds={new Set()}
      onToggle={onToggle}
      viewerTimezone="America/New_York"
      {...overrides}
    />,
  );
}

describe('ActivityItem', () => {
  it('renders the activity row without inline avatars', () => {
    const { UNSAFE_getAllByType } = renderActivity(makeBaseActivity());

    expect(UNSAFE_getAllByType(MessageSquare).length).toBeGreaterThan(0);
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('Math Foundations')).toBeTruthy();
  });

  it('marks unread activities read when the row is pressed', () => {
    const onMarkRead = jest.fn();

    renderActivity(makeBaseActivity(), { onMarkRead });

    fireEvent.press(screen.getByText('Priya Sharma'));

    expect(onMarkRead).toHaveBeenCalledWith('activity-1');
  });

  it('does not mark already-read activities read again when the row is pressed', () => {
    const onMarkRead = jest.fn();
    const item = {
      ...makeBaseActivity(),
      state: { ...makeBaseActivity().state, isRead: true },
    } as ActivityFeedItemVM;

    renderActivity(item, { onMarkRead });

    fireEvent.press(screen.getByText('Priya Sharma'));

    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it('formats scheduled class session headlines without the timezone suffix', () => {
    const item = {
      ...makeBaseActivity(),
      content: {
        ...makeBaseActivity().content,
        headline: {
          primary: 'Class session 2026-03-19T22:00:00.000Z',
          secondary: 'Math Foundations',
        },
      },
      metadata: {
        sessionGroupLocalTime: true,
        occurrenceStart: '2026-03-19T22:00:00.000Z',
        timezone: 'America/New_York',
      },
    } as ActivityFeedItemVM;

    expect(formatActivityPrimaryHeadline(item, 'America/New_York')).toBe(
      'Class session Mar 19 at 6:00 PM',
    );
  });

  it('preserves context-rich activity headlines', () => {
    const item = {
      ...makeBaseActivity(),
      content: {
        ...makeBaseActivity().content,
        headline: {
          primary: 'Class reminder',
          secondary: 'Algebra I for Priya with Ms. Chen',
        },
      },
      metadata: {
        preserveActivitySummary: true,
        sessionGroupLocalTime: true,
        occurrenceStart: '2026-03-19T22:00:00.000Z',
        timezone: 'America/New_York',
      },
    } as ActivityFeedItemVM;

    expect(formatActivityPrimaryHeadline(item, 'America/New_York')).toBe(
      'Class reminder',
    );
  });

  it('renders the feedback widget inline for feedback request activities', () => {
    const item = {
      ...makeBaseActivity(),
      verb: 'session.feedback_request.sent',
      content: {
        headline: {
          primary: 'Class feedback requested',
          secondary: "How was Scott S's Math with Ms Barbara session today?",
        },
      },
      metadata: {
        sourceEventId: '11111111-1111-4111-8111-111111111111',
        classSessionId: '33333333-3333-4333-8333-333333333333',
        classroomId: '44444444-4444-4444-8444-444444444444',
        channelId: '55555555-5555-4555-8555-555555555555',
        feedbackUiEnabled: true,
      },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(screen.getByText('Rate your session')).toBeTruthy();
    expect(screen.getByLabelText('Rate 3 stars')).toBeTruthy();
  });
});
