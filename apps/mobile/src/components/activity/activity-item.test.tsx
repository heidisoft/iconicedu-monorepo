import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Bell, CalendarCheck, CalendarX, MessageSquare, Star } from 'lucide-react-native';

import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

import {
  ACTIVITY_ICON_MAP,
  ActivityItem,
  formatActivityPrimaryHeadline,
  getIconKey,
  makeActivityItemStyles,
} from './activity-item';
import { lightColors } from '@/lib/theme';

const mockSubmitActivityFeedFeedback = jest.fn();
const mockSubmitCompletionVote = jest.fn();

jest.mock('@/lib/api/activity-feed/feedback', () => ({
  submitActivityFeedFeedback: (...args: unknown[]) =>
    mockSubmitActivityFeedFeedback(...args),
}));

jest.mock('@/lib/api/activity-feed/completion-vote', () => ({
  submitCompletionVote: (...args: unknown[]) => mockSubmitCompletionVote(...args),
}));

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

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('ActivityItem', () => {
  afterEach(() => {
    jest.useRealTimers();
    mockSubmitActivityFeedFeedback.mockReset();
    mockSubmitCompletionVote.mockReset();
  });

  it('renders the activity row without inline avatars', () => {
    const { UNSAFE_getAllByType } = renderActivity(makeBaseActivity());

    expect(UNSAFE_getAllByType(MessageSquare).length).toBeGreaterThan(0);
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('Math Foundations')).toBeTruthy();
  });

  it.each([
    ['class.session.rescheduled', 'CalendarCheck', CalendarCheck],
    ['class.session.canceled', 'CalendarX', CalendarX],
    ['session.reminder.sent', 'Bell', Bell],
    ['session.feedback_request.sent', 'Star', Star],
  ] as const)('displays the correct icon for %s notifications', (verb, iconKey, Icon) => {
    const item = {
      ...makeBaseActivity(),
      verb,
      content: {
        ...makeBaseActivity().content,
        leading: { kind: 'icon', iconKey, tone: 'info' },
        headline: {
          primary: 'Class update',
          secondary: 'For Rhea with Ms. Denise',
        },
      },
    } as ActivityFeedItemVM;

    const { UNSAFE_getAllByType } = renderActivity(item);

    expect(getIconKey(item)).toBe(iconKey);
    expect(ACTIVITY_ICON_MAP[iconKey]).toBe(Icon);
    expect(UNSAFE_getAllByType(Icon).length).toBeGreaterThan(0);
  });

  it.each([
    ['class.session.rescheduled', 'CalendarCheck'],
    ['class.session.canceled', 'CalendarX'],
    ['session.reminder.sent', 'Bell'],
    ['session.feedback_request.sent', 'Star'],
  ] as const)('falls back to the correct icon key for %s', (verb, iconKey) => {
    const item = {
      ...makeBaseActivity(),
      verb,
      content: {
        ...makeBaseActivity().content,
        leading: undefined,
      },
    } as ActivityFeedItemVM;

    expect(getIconKey(item)).toBe(iconKey);
  });

  it('marks unread activities read when the row is pressed', () => {
    const onMarkRead = jest.fn();

    renderActivity(makeBaseActivity(), { onMarkRead });

    expect(screen.getByLabelText('Unread')).toBeTruthy();
    fireEvent.press(screen.getByText('Priya Sharma'));

    expect(onMarkRead).toHaveBeenCalledWith('activity-1');
  });

  it('shows a read check-check indicator for read activities', () => {
    const item = {
      ...makeBaseActivity(),
      state: { ...makeBaseActivity().state, isRead: true },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(screen.getByLabelText('Read')).toBeTruthy();
    expect(screen.queryByLabelText('Unread')).toBeNull();
  });

  it('only displays Read more when expanded content exists', () => {
    const withoutExpandedContent = makeBaseActivity();
    renderActivity(withoutExpandedContent);
    expect(screen.queryByText('Read more')).toBeNull();
  });

  it('hides the preview card when preview text is empty', () => {
    const item = {
      ...makeBaseActivity(),
      content: {
        ...makeBaseActivity().content,
        summary: '   ',
        preview: { text: '   ' },
      },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(screen.queryByText('A short preview')).toBeNull();
  });

  it('uses content.preview.text when summary is empty', () => {
    const item = {
      ...makeBaseActivity(),
      content: {
        ...makeBaseActivity().content,
        summary: '   ',
        preview: { text: 'Preview from projected content' },
      },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(screen.getByText('Preview from projected content')).toBeTruthy();
  });

  it('does not display Read more for blank expanded content', () => {
    const item = {
      ...makeBaseActivity(),
      content: {
        ...makeBaseActivity().content,
        expandedContent: '   ',
      },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(screen.queryByText('Read more')).toBeNull();
  });

  it('displays Read more when expanded content is present', () => {
    const item = {
      ...makeBaseActivity(),
      content: {
        ...makeBaseActivity().content,
        expandedContent: 'Reason: Teacher conflict',
      },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(screen.getByText('Read more')).toBeTruthy();
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

  it('calls the activity action handler when the action button is pressed', () => {
    const onActionPress = jest.fn();
    const item = {
      ...makeBaseActivity(),
      content: {
        ...makeBaseActivity().content,
        actionButton: { label: 'Open class', variant: 'outline' },
      },
    } as ActivityFeedItemVM;

    renderActivity(item, { onActionPress });

    fireEvent.press(screen.getByText('Open class'));

    expect(onActionPress).toHaveBeenCalledWith(item);
  });

  it('renders feedback requests in the preview position without an action button', () => {
    const onActionPress = jest.fn();
    const item = {
      ...makeBaseActivity(),
      verb: 'session.feedback_request.sent',
      content: {
        ...makeBaseActivity().content,
        summary: 'Tell us how the session went',
        actionButton: { label: 'Give feedback', variant: 'outline' },
      },
      metadata: {
        feedbackUiEnabled: true,
        sourceEventId: 'event-1',
        classSessionId: 'session-1',
        classroomId: 'space-1',
        channelId: 'channel-1',
      },
    } as ActivityFeedItemVM;

    renderActivity(item, {
      onActionPress,
      currentProfileId: 'profile-1',
    });

    expect(screen.getByText('Rate your session')).toBeTruthy();
    expect(screen.queryByText('Tell us how the session went')).toBeNull();
    expect(screen.queryByText('Give feedback')).toBeNull();
  });

  it('allows feedback requests that use schedule and learning space metadata aliases', () => {
    const item = {
      ...makeBaseActivity(),
      verb: 'session.feedback_request.sent',
      content: {
        ...makeBaseActivity().content,
        summary: 'Tell us how the session went',
        actionButton: { label: 'Give feedback', variant: 'outline' },
      },
      metadata: {
        feedbackUiEnabled: true,
        sourceEventId: 'event-1',
        scheduleId: 'session-1',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        startAt: '2026-03-19T22:00:00.000Z',
      },
    } as ActivityFeedItemVM;

    renderActivity(item, {
      currentProfileId: 'profile-1',
    });

    expect(screen.getByText('Rate your session')).toBeTruthy();
    expect(screen.queryByText('Feedback is unavailable for this session.')).toBeNull();
  });

  it('autosaves low-rating comments and uses a button to collapse to the submitted state', async () => {
    jest.useFakeTimers();
    mockSubmitActivityFeedFeedback
      .mockResolvedValueOnce({
        submittedAt: '2026-04-02T12:05:00.000Z',
        rating: 4,
        comment: null,
      })
      .mockResolvedValueOnce({
        submittedAt: '2026-04-02T12:06:00.000Z',
        rating: 4,
        comment: 'Helpful, but a little fast.',
      });
    const item = {
      ...makeBaseActivity(),
      verb: 'session.feedback_request.sent',
      content: {
        ...makeBaseActivity().content,
        summary: 'Tell us how the session went',
      },
      metadata: {
        feedbackUiEnabled: true,
        sourceEventId: 'event-1',
        classSessionId: 'session-1',
        classroomId: 'space-1',
        channelId: 'channel-1',
      },
    } as ActivityFeedItemVM;

    renderActivity(item, {
      currentProfileId: 'profile-1',
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Rate 4 stars'));
      await flushMicrotasks();
    });
    expect(screen.getByText('Submit feedback')).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Tell us what could be better...'),
        'Helpful, but a little fast.',
      );
      await flushMicrotasks();
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
      await flushMicrotasks();
    });

    expect(mockSubmitActivityFeedFeedback).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Submit feedback')).toBeTruthy();
    expect(screen.queryByText('Rating saved. Comments save automatically.')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText('Submit feedback'));
      await flushMicrotasks();
    });

    expect(screen.getByText('Thank you for your feedback.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Tell us what could be better...')).toBeNull();
    expect(mockSubmitActivityFeedFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rating: 4,
        comment: 'Helpful, but a little fast.',
        recipientProfileId: 'profile-1',
      }),
    );
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

  it('tracks completion check batch responses by occurrence start', () => {
    const item = {
      ...makeBaseActivity(),
      verb: 'session.completion_check.batch.sent',
      content: {
        ...makeBaseActivity().content,
        headline: { primary: 'Confirm your lessons' },
      },
      metadata: {
        sessions: [
          {
            scheduleId: 'schedule-1',
            occurrenceStart: '2026-03-19T22:00:00.000Z',
            title: 'Math Foundations',
            channelId: 'channel-1',
            learningSpaceId: 'space-1',
            completionVote: { status: 'confirmed' },
          },
          {
            scheduleId: 'schedule-1',
            occurrenceStart: '2026-03-20T22:00:00.000Z',
            title: 'Math Foundations',
            channelId: 'channel-1',
            learningSpaceId: 'space-1',
          },
        ],
      },
    } as ActivityFeedItemVM;

    renderActivity(item);
    mockSubmitCompletionVote.mockResolvedValue({ feedbackEnabled: true });

    expect(screen.getByText('1 of 2 confirmed')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Math Foundations — resolved'));
    expect(
      screen.getByText("You've already responded — thanks for letting us know!"),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Math Foundations — needs confirmation'));
    expect(screen.getByText('Confirm Lesson')).toBeTruthy();
  });

  it('submits completion votes for the current inbox profile', async () => {
    mockSubmitCompletionVote.mockResolvedValue({ feedbackEnabled: true });
    const item = {
      ...makeBaseActivity(),
      verb: 'session.completion_check.sent',
      content: {
        ...makeBaseActivity().content,
        headline: { primary: 'Confirm your lesson' },
      },
      metadata: {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceStart: '2026-03-19T22:00:00.000Z',
        roleContext: 'guardian',
        completionCheckUiEnabled: true,
      },
    } as ActivityFeedItemVM;

    renderActivity(item, { currentProfileId: 'profile-1' });

    fireEvent.press(screen.getByText('Confirm Lesson'));

    await waitFor(() => {
      expect(mockSubmitCompletionVote).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          scheduleId: 'schedule-1',
          occurrenceKey: '2026-03-19T22:00:00.000Z',
          role: 'guardian',
          status: 'confirmed',
          recipientProfileId: 'profile-1',
        }),
      );
    });
  });
});
