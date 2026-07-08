/* @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActivityItemBase } from './activity-item-base';
import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

vi.mock('@iconicedu/ui-web/components/notification/activity-badge', () => ({
  ActivityBadge: () => null,
}));

vi.mock('@iconicedu/ui-web/components/notification/activity-with-button', () => ({
  ActivityWithButton: () => null,
}));

function createActivity(): ActivityFeedItemVM {
  return {
    kind: 'item',
    ids: { id: 'activity-1', orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-03-13T10:00:00.000Z',
      createdAt: '2026-03-13T10:00:00.000Z',
    },
    tabKey: 'all',
    audience: {
      scope: { kind: 'personal' },
      visibility: 'visible',
    },
    verb: 'message.posted',
    refs: {
      actor: {
        profileId: 'profile-1',
        displayName: 'Dinithi D',
      },
    },
    content: {
      headline: {
        primary: 'Dinithi D sent you a direct message',
        secondary: 'Direct message',
        secondaryHref: '../dm/channel-dm-1',
      },
      expandedContent: 'Hello there',
    },
    state: {
      isRead: false,
    },
  } as ActivityFeedItemVM;
}

describe('ActivityItemBase', () => {
  it('links the secondary headline to the conversation when secondaryHref is provided', () => {
    render(<ActivityItemBase activity={createActivity()} onMarkRead={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'Direct message' });
    expect(link).toHaveAttribute('href', '../dm/channel-dm-1');
  });

  it('renders secondary headline as text when no headline link is provided', () => {
    const activity = createActivity();
    activity.content.headline.secondaryHref = undefined;

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.getByText('Direct message').tagName).toBe('SPAN');
  });

  it('renders a vertical connector when timeline connector is enabled', () => {
    const { container } = render(
      <ActivityItemBase
        activity={createActivity()}
        onMarkRead={vi.fn()}
        showTimelineConnector
      />,
    );

    expect(
      container.querySelector(
        '.absolute.left-1\\/2.top-7.hidden.h-\\[calc\\(100\\%\\+1rem\\)\\].w-px',
      ),
    ).not.toBeNull();
  });

  it('renders preview text when summary is absent', () => {
    const activity = createActivity();
    activity.content.summary = undefined;
    activity.content.preview = { text: 'Preview from projected content' };

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.getByText('Preview from projected content')).toBeInTheDocument();
  });

  it('renders preview text even when expanded content footer is present', () => {
    const activity = createActivity();
    activity.content.summary = undefined;
    activity.content.preview = { text: 'Message preview text' };

    render(
      <ActivityItemBase
        activity={activity}
        onMarkRead={vi.fn()}
        footer={<div>Expanded detail</div>}
      />,
    );

    expect(screen.getByText('Message preview text')).toBeInTheDocument();
    expect(screen.getByText('Expanded detail')).toBeInTheDocument();
  });

  it('prefers summary over preview text when both are present', () => {
    const activity = createActivity();
    activity.content.summary = 'Summary preview';
    activity.content.preview = { text: 'Projected preview' };

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.getByText('Summary preview')).toBeInTheDocument();
    expect(screen.queryByText('Projected preview')).not.toBeInTheDocument();
  });

  it('renders session change decision buttons for an educator reviewing a parent request', () => {
    const activity = {
      ...createActivity(),
      verb: 'class.session.reschedule_requested',
      metadata: {
        requestId: 'request-1',
        requestedByProfileId: 'guardian-1',
        requestedByRole: 'guardian',
        viewerRole: 'educator',
      },
      content: {
        ...createActivity().content,
        headline: {
          primary: 'Session change request',
          secondary: 'Lura H requested a reschedule',
        },
      },
    } as ActivityFeedItemVM;
    const onDecision = vi.fn();

    render(
      <ActivityItemBase
        activity={activity}
        onMarkRead={vi.fn()}
        currentProfileId="teacher-1"
        pendingSessionChangeRequestIds={new Set(['request-1'])}
        onSessionChangeDecision={onDecision}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));

    expect(onDecision).toHaveBeenNthCalledWith(1, activity, 'approve');
    expect(onDecision).toHaveBeenNthCalledWith(2, activity, 'reject');
  });

  it('does not render session change actions for the requester', () => {
    const activity = {
      ...createActivity(),
      verb: 'class.session.reschedule_requested',
      metadata: {
        requestId: 'request-1',
        requestedByProfileId: 'guardian-1',
        requestedByRole: 'guardian',
        viewerRole: 'guardian',
      },
    } as ActivityFeedItemVM;

    render(
      <ActivityItemBase
        activity={activity}
        onMarkRead={vi.fn()}
        currentProfileId="guardian-1"
        pendingSessionChangeRequestIds={new Set(['request-1'])}
        onSessionChangeDecision={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();
  });

  it('hides preview text when summary and preview are blank', () => {
    const activity = createActivity();
    activity.content.summary = '   ';
    activity.content.preview = { text: '   ' };

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.queryByText('Preview from projected content')).not.toBeInTheDocument();
  });

  it('renders feedback rating controls in the preview slot for feedback requests', () => {
    const activity = {
      ...createActivity(),
      kind: 'leaf',
      verb: 'session.feedback_request.sent',
      content: {
        ...createActivity().content,
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

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.getByText('Rate your session')).toBeInTheDocument();
    expect(screen.queryByText('Tell us how the session went')).not.toBeInTheDocument();
  });

  it('allows feedback requests that use schedule and learning space metadata aliases', () => {
    const activity = {
      ...createActivity(),
      kind: 'leaf',
      verb: 'session.feedback_request.sent',
      content: {
        ...createActivity().content,
        summary: 'Tell us how the session went',
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

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.getByText('Rate your session')).toBeInTheDocument();
    expect(
      screen.queryByText('Feedback is unavailable for this session.'),
    ).not.toBeInTheDocument();
  });

  it('tracks completion check batch responses by occurrence start', () => {
    const activity = {
      ...createActivity(),
      kind: 'leaf',
      verb: 'session.completion_check.batch.sent',
      content: {
        ...createActivity().content,
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

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.getByText('1 of 2 confirmed')).toBeInTheDocument();

    const sessionButtons = screen.getAllByRole('button', { name: /Math Foundations/ });
    fireEvent.click(sessionButtons[0]!);
    expect(
      screen.getByText("You've already responded — thanks for letting us know!"),
    ).toBeInTheDocument();

    fireEvent.click(sessionButtons[1]!);
    expect(screen.getByText('Confirm Lesson')).toBeInTheDocument();
  });
});
