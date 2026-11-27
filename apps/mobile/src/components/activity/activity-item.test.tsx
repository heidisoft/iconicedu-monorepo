import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  AlertCircle,
  Bell,
  CalendarCheck,
  CalendarX,
  MessageSquare,
  Star,
} from 'lucide-react-native';

import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

import {
  ACTIVITY_ICON_MAP,
  ActivityItem,
  compactTime,
  formatActivityPrimaryHeadline,
  formatFeedSectionLabel,
  getActivityTag,
  getIconKey,
  getLeadingAvatar,
  isPreviewRedundant,
  makeActivityItemStyles,
  metaTime,
} from './activity-item';
import { shouldShowCompletionPromptTitle } from './activity-completion-check';
import { lightColors } from '@/lib/theme';

const mockRateSessionCompletion = jest.fn();
const mockConfirmSessionCompletion = jest.fn();
const mockDisputeSessionCompletion = jest.fn();

jest.mock('@/lib/api/session-completions', () => ({
  rateSessionCompletion: (...args: unknown[]) => mockRateSessionCompletion(...args),
  confirmSessionCompletion: (...args: unknown[]) => mockConfirmSessionCompletion(...args),
  disputeSessionCompletion: (...args: unknown[]) => mockDisputeSessionCompletion(...args),
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

describe('ActivityItem', () => {
  afterEach(() => {
    jest.useRealTimers();
    mockRateSessionCompletion.mockReset();
    mockConfirmSessionCompletion.mockReset();
    mockDisputeSessionCompletion.mockReset();
  });

  it('leads person-driven activity with the actor avatar and a type badge', () => {
    const { UNSAFE_getAllByType } = renderActivity(makeBaseActivity());

    expect(screen.getByTestId('activity-leading-avatar')).toBeTruthy();
    expect(screen.getByText('PS')).toBeTruthy();
    expect(UNSAFE_getAllByType(MessageSquare).length).toBeGreaterThan(0);
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('Math Foundations')).toBeTruthy();
  });

  it('keeps the tone icon chip for system activity even when an actor exists', () => {
    const item = {
      ...makeBaseActivity(),
      verb: 'session.reminder.sent',
      content: {
        ...makeBaseActivity().content,
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
      },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(getLeadingAvatar(item)).toBeNull();
    expect(screen.getByTestId('activity-leading-icon')).toBeTruthy();
    expect(screen.queryByTestId('activity-leading-avatar')).toBeNull();
  });

  it('uses the first leading avatar when the projection supplies avatars', () => {
    const item = {
      ...makeBaseActivity(),
      verb: 'class.schedule.created',
      content: {
        ...makeBaseActivity().content,
        leading: {
          kind: 'avatars',
          avatars: [
            {
              name: 'Barbara Young',
              avatar: { source: 'upload', url: 'https://example.test/b.png' },
              profileId: 'profile-2',
            },
          ],
        },
      },
    } as ActivityFeedItemVM;

    expect(getLeadingAvatar(item)).toEqual({
      name: 'Barbara Young',
      url: 'https://example.test/b.png',
      seed: 'profile-2',
      themeKey: null,
    });
  });

  it('hides a preview that only repeats the headline', () => {
    const item = {
      ...makeBaseActivity(),
      verb: 'session.reminder.sent',
      content: {
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: {
          primary: 'ELA with Ms Denise',
          secondary:
            'Class session starts Wednesday, April 8 at 9:00 AM EDT · For Scott S with Denise R',
        },
        summary: 'Class session starts Wednesday, April 8 at 9:00 AM EDT',
        actionButton: { label: 'Open class', variant: 'outline' },
      },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(
      screen.queryByText('Class session starts Wednesday, April 8 at 9:00 AM EDT'),
    ).toBeNull();
    expect(screen.getByText('Open class')).toBeTruthy();
  });

  it('detects redundant previews regardless of case, spacing and trailing punctuation', () => {
    expect(
      isPreviewRedundant(
        'Class   session STARTS soon · For Scott',
        'class session starts soon.',
      ),
    ).toBe(true);
    expect(isPreviewRedundant('Marc F sent a message', 'Hellow how are you')).toBe(false);
    expect(isPreviewRedundant('Anything', '   ')).toBe(true);
  });

  it('splits system notifications into a title, a detail line and a status tag', () => {
    const item = {
      ...makeBaseActivity(),
      verb: 'class.session.rescheduled',
      content: {
        leading: { kind: 'icon', iconKey: 'CalendarCheck', tone: 'warning' },
        headline: {
          primary: 'ELA with Ms Denise',
          secondary: 'Moved to Thu, Apr 9 at 10:00 AM',
        },
      },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(screen.getByText('ELA with Ms Denise')).toBeTruthy();
    expect(screen.getByText('Moved to Thu, Apr 9 at 10:00 AM')).toBeTruthy();
    expect(screen.getByText('Rescheduled')).toBeTruthy();
  });

  it('does not tag person-driven notifications', () => {
    renderActivity(makeBaseActivity());

    expect(getActivityTag(makeBaseActivity())).toBeNull();
    expect(screen.queryByTestId('activity-tag')).toBeNull();
  });

  it('tags completion checks by their resolution status', () => {
    const base = { ...makeBaseActivity(), verb: 'session.completion_check.sent' };
    expect(getActivityTag(base as ActivityFeedItemVM)).toEqual({
      label: 'Action needed',
      tone: 'warning',
    });
    expect(
      getActivityTag({
        ...base,
        metadata: { sessionCompletion: { status: 'auto_confirmed' } },
      } as ActivityFeedItemVM),
    ).toEqual({ label: 'Confirmed', tone: 'success' });
    expect(
      getActivityTag({
        ...base,
        metadata: { sessionCompletion: { status: 'disputed' } },
      } as ActivityFeedItemVM),
    ).toEqual({ label: 'Reported', tone: 'danger' });
  });

  it('places Read more beside the action button in one row', () => {
    const onToggle = jest.fn();
    const item = {
      ...makeBaseActivity(),
      content: {
        ...makeBaseActivity().content,
        expandedContent: 'Full message body',
        actionButton: { label: 'Open message', variant: 'outline' },
      },
    } as ActivityFeedItemVM;

    renderActivity(item, { onToggle });

    const row = screen.getByTestId('activity-actions-row');
    expect(within(row).getByLabelText('Open message')).toBeTruthy();
    expect(within(row).getByText('Read more')).toBeTruthy();
    fireEvent.press(within(row).getByText('Read more'));
    expect(onToggle).toHaveBeenCalledWith('activity-1');
  });

  it('formats meta timestamps and dated section headers', () => {
    const now = new Date('2026-04-10T12:00:00.000Z').getTime();
    expect(metaTime('2026-04-10T11:59:30.000Z', now)).toBe('Just now');
    expect(metaTime('2026-04-10T11:55:00.000Z', now)).toBe('5m ago');
    expect(metaTime('2026-03-04T12:00:00.000Z', now)).toBe('Mar 4');

    expect(formatFeedSectionLabel('Today', '2026-03-09T15:00:00.000Z')).toBe(
      'Today, Mar 9',
    );
    expect(formatFeedSectionLabel('This week', '2026-03-06T15:00:00.000Z')).toBe(
      'This week',
    );
    expect(formatFeedSectionLabel('Today', undefined)).toBe('Today');
  });

  it('formats compact timestamps for the top-right corner', () => {
    const now = new Date('2026-04-10T12:00:00.000Z').getTime();
    expect(compactTime('2026-04-10T11:59:30.000Z', now)).toBe('now');
    expect(compactTime('2026-04-10T11:55:00.000Z', now)).toBe('5m');
    expect(compactTime('2026-04-10T09:00:00.000Z', now)).toBe('3h');
    expect(compactTime('2026-04-08T12:00:00.000Z', now)).toBe('2d');
    expect(compactTime('2026-03-04T12:00:00.000Z', now)).toBe('Mar 4');
    expect(compactTime('not-a-date', now)).toBe('');
  });

  it('only shows the completion prompt title when it adds to the headline', () => {
    const headline = 'Confirm the lesson for Scott S and Andrea S with Barbara Y';
    expect(shouldShowCompletionPromptTitle(headline.toUpperCase(), headline)).toBe(false);
    expect(
      shouldShowCompletionPromptTitle('Confirm your lesson', 'Math with Ms Barbara'),
    ).toBe(true);
    expect(shouldShowCompletionPromptTitle('Confirm your lesson', undefined)).toBe(true);
  });

  it.each([
    ['class.session.rescheduled', 'CalendarCheck', CalendarCheck],
    ['class.session.canceled', 'CalendarX', CalendarX],
    ['message.unviewed_intended_participants', 'AlertCircle', AlertCircle],
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
    ['message.unviewed_intended_participants', 'AlertCircle'],
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

  it('drops the unread dot once the activity is read', () => {
    const item = {
      ...makeBaseActivity(),
      state: { ...makeBaseActivity().state, isRead: true },
    } as ActivityFeedItemVM;

    renderActivity(item);

    expect(screen.queryByLabelText('Unread')).toBeNull();
    expect(screen.queryByTestId('activity-unread-indicator')).toBeNull();
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
        sessionCompletionId: 'completion-1',
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
        sessionCompletionId: 'completion-1',
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

  function makeFeedbackRequest(
    sessionCompletion: Record<string, unknown>,
  ): ActivityFeedItemVM {
    return {
      ...makeBaseActivity(),
      verb: 'session.feedback_request.sent',
      content: {
        ...makeBaseActivity().content,
        summary: 'Tell us how the session went',
      },
      metadata: {
        feedbackUiEnabled: true,
        sessionCompletionId: 'completion-1',
        sessionCompletion,
      },
    } as ActivityFeedItemVM;
  }

  it('drops the standalone rating tile once the session is confirmed', () => {
    renderActivity(makeFeedbackRequest({ id: 'completion-1', status: 'confirmed' }), {
      currentProfileId: 'profile-1',
    });

    expect(screen.queryByText('Rate your session')).toBeNull();
  });

  it('drops the standalone rating tile once the session is disputed', () => {
    renderActivity(makeFeedbackRequest({ id: 'completion-1', status: 'disputed' }), {
      currentProfileId: 'profile-1',
    });

    expect(screen.queryByText('Rate your session')).toBeNull();
  });

  it('auto-dismisses an untouched rating tile after a few seconds', () => {
    jest.useFakeTimers();

    renderActivity(makeFeedbackRequest({ id: 'completion-1', status: 'pending' }), {
      currentProfileId: 'profile-1',
    });

    expect(screen.getByText('Rate your session')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(screen.queryByText('Rate your session')).toBeNull();
  });

  it('keeps the rating tile open once the user taps a star', async () => {
    jest.useFakeTimers();
    mockRateSessionCompletion.mockResolvedValue({
      submittedAt: '2026-04-02T12:05:00.000Z',
      rating: 5,
      comment: null,
    });

    renderActivity(makeFeedbackRequest({ id: 'completion-1', status: 'pending' }), {
      currentProfileId: 'profile-1',
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Rate 5 stars'));
    });

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(screen.getByText('Rate your session')).toBeTruthy();
  });

  it('autosaves low-rating comments and uses a button to collapse to the submitted state', async () => {
    jest.useFakeTimers();
    mockRateSessionCompletion
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
        sessionCompletionId: 'completion-1',
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
    });

    expect(mockRateSessionCompletion).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Saving...')).toBeNull();
    expect(screen.getByText('Submit feedback')).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText('Tell us what could be better...'),
      'Helpful, but a little fast.',
    );

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(mockRateSessionCompletion).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Submit feedback')).toBeTruthy();
    expect(screen.queryByText('Rating saved. Comments save automatically.')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText('Submit feedback'));
    });

    expect(screen.getByText('Thank you for your feedback.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Tell us what could be better...')).toBeNull();
    expect(mockRateSessionCompletion).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rating: 4,
        comment: 'Helpful, but a little fast.',
        sessionCompletionId: 'completion-1',
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
            sessionCompletionId: 'completion-1',
            sessionCompletion: { id: 'completion-1', status: 'confirmed' },
          },
          {
            scheduleId: 'schedule-1',
            occurrenceStart: '2026-03-20T22:00:00.000Z',
            title: 'Math Foundations',
            channelId: 'channel-1',
            learningSpaceId: 'space-1',
            sessionCompletionId: 'completion-2',
          },
        ],
      },
    } as ActivityFeedItemVM;

    renderActivity(item);
    mockConfirmSessionCompletion.mockResolvedValue({ feedbackEnabled: true });

    expect(screen.getByText('1 of 2 confirmed')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Math Foundations — resolved'));
    // Already-confirmed on load (not a fresh in-session confirm) → the plain
    // "marked as completed" message rather than the fresh-confirm feedback prompt.
    expect(screen.getByText('This session has been marked as completed.')).toBeTruthy();
    expect(screen.getByText('Rate your session')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Math Foundations — needs confirmation'));
    expect(screen.getByLabelText('Confirm lesson')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('submits completion confirmation by stable row id', async () => {
    mockConfirmSessionCompletion.mockResolvedValue({ feedbackEnabled: true });
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
        sessionCompletionId: 'completion-1',
      },
    } as ActivityFeedItemVM;

    renderActivity(item, { currentProfileId: 'profile-1' });

    fireEvent.press(screen.getByLabelText('Confirm lesson'));

    await waitFor(() => {
      expect(mockConfirmSessionCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          sessionCompletionId: 'completion-1',
        }),
      );
    });
  });
});
