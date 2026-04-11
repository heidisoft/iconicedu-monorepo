import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';
import { lightColors } from '@/lib/theme';
import {
  ActivityFeedbackRequest,
  canRenderMobileActivityFeedbackRequest,
} from './activity-feedback-request';

const mockSubmitActivityFeedFeedback = jest.fn();

jest.mock('@/lib/api/activity-feed/feedback', () => ({
  submitActivityFeedFeedback: (...args: unknown[]) =>
    mockSubmitActivityFeedFeedback(...args),
}));

function createActivity(
  metadata: Partial<Record<string, unknown>> = {},
): ActivityFeedLeafItemVM {
  return {
    kind: 'leaf',
    ids: { id: 'activity-1', orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-03-16T10:00:00.000Z',
      createdAt: '2026-03-16T10:00:00.000Z',
    },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'session.feedback_request.sent',
    refs: { actor: {} as never },
    content: {
      headline: {
        primary: 'Class feedback requested',
        secondary: "How was Scott S's Math with Ms Barbara session today?",
      },
      summary: 'Rate this class in one minute.',
    },
    state: { isRead: false },
    metadata: {
      sourceEventId: '11111111-1111-4111-8111-111111111111',
      messageId: '22222222-2222-4222-8222-222222222222',
      classSessionId: '33333333-3333-4333-8333-333333333333',
      classroomId: '44444444-4444-4444-8444-444444444444',
      channelId: '55555555-5555-4555-8555-555555555555',
      occurrenceStart: '2026-03-16T10:00:00.000Z',
      feedbackUiEnabled: true,
      ...metadata,
    },
  };
}

describe('ActivityFeedbackRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('submits five-star feedback immediately', async () => {
    mockSubmitActivityFeedFeedback.mockResolvedValue({
      submittedAt: '2026-03-16T10:01:00.000Z',
      rating: 5,
      comment: null,
    });

    render(
      <ActivityFeedbackRequest
        activity={createActivity()}
        colors={lightColors}
        currentProfileId="profile-1"
      />,
    );

    fireEvent.press(screen.getByLabelText('Rate 5 stars'));

    await waitFor(() => {
      expect(mockSubmitActivityFeedFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          rating: 5,
          recipientProfileId: 'profile-1',
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Thank you for your feedback.')).toBeTruthy();
    });
  });

  it('allows submitting ratings below five stars', async () => {
    jest.useFakeTimers();
    mockSubmitActivityFeedFeedback.mockResolvedValue({
      submittedAt: '2026-03-16T10:01:00.000Z',
      rating: 3,
      comment: null,
    });

    render(
      <ActivityFeedbackRequest
        activity={createActivity()}
        colors={lightColors}
        currentProfileId="profile-1"
      />,
    );

    fireEvent.press(screen.getByLabelText('Rate 3 stars'));

    await waitFor(() => {
      expect(mockSubmitActivityFeedFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 3,
          comment: null,
        }),
      );
    });

    expect(screen.getByText('Rating saved. Comments save automatically.')).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText('Tell us what could be better...'),
      'Need more examples.',
    );

    await waitFor(() => {
      expect(screen.getByText('Saving shortly...')).toBeTruthy();
    });

    mockSubmitActivityFeedFeedback.mockResolvedValue({
      submittedAt: '2026-03-16T10:01:05.000Z',
      rating: 3,
      comment: 'Need more examples.',
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(mockSubmitActivityFeedFeedback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          rating: 3,
          comment: 'Need more examples.',
        }),
      );
    });
    expect(screen.queryByText('Thank you for your feedback.')).toBeNull();
  });

  it('allows temporary re-rating after submit', async () => {
    jest.useFakeTimers();
    mockSubmitActivityFeedFeedback
      .mockResolvedValueOnce({
        submittedAt: new Date().toISOString(),
        rating: 4,
        comment: 'Need more examples.',
      })
      .mockResolvedValueOnce({
        submittedAt: new Date(Date.now() + 1_000).toISOString(),
        rating: 5,
        comment: null,
      });

    render(
      <ActivityFeedbackRequest
        activity={createActivity()}
        colors={lightColors}
        currentProfileId="profile-1"
      />,
    );

    fireEvent.press(screen.getByLabelText('Rate 4 stars'));

    await waitFor(() => {
      expect(mockSubmitActivityFeedFeedback).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByLabelText('Rate 5 stars'));

    await waitFor(() => {
      expect(mockSubmitActivityFeedFeedback).toHaveBeenCalledTimes(2);
    });
  });

  it('disables the feedback card when the UI is not enabled', () => {
    const activity = createActivity({ feedbackUiEnabled: false });

    expect(canRenderMobileActivityFeedbackRequest(activity)).toBe(false);

    const { toJSON } = render(
      <ActivityFeedbackRequest
        activity={activity}
        colors={lightColors}
        currentProfileId="profile-1"
      />,
    );

    expect(toJSON()).toBeNull();
  });
});
