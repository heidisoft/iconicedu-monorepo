/* @vitest-environment jsdom */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  ActivityFeedbackRequest,
  canRenderActivityFeedbackRequest,
} from './activity-feedback-request';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';

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
    audience: {
      scope: { kind: 'global' },
      visibility: 'public',
    },
    verb: 'session.feedback_request.sent',
    refs: { actor: {} as never },
    content: {
      headline: {
        primary: 'Class feedback requested',
        secondary: 'How was your Algebra session today?',
      },
      summary: 'Rate this class in one minute.',
    },
    state: { isRead: false },
    metadata: {
      sourceEventId: 'event-1',
      messageId: 'message-1',
      classSessionId: '11111111-1111-4111-8111-111111111111',
      classroomId: '22222222-2222-4222-8222-222222222222',
      channelId: '33333333-3333-4333-8333-333333333333',
      occurrenceStart: '2026-03-16T10:00:00.000Z',
      feedbackUiEnabled: true,
      ...metadata,
    },
  };
}

describe('ActivityFeedbackRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('previews cumulative hover state and submits five-star feedback immediately', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: { submittedAt: '2026-03-16T10:01:00.000Z', rating: 5, comment: null },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<ActivityFeedbackRequest activity={createActivity()} />);

    const starTwo = screen.getByRole('button', { name: 'Rate 2 stars' });
    await user.hover(starTwo);

    const starIcons = screen
      .getAllByRole('button')
      .map((button) => button.querySelector('svg'));
    expect(starIcons[0]?.getAttribute('class')).toContain('fill-amber-400');
    expect(starIcons[1]?.getAttribute('class')).toContain('fill-amber-400');
    expect(starIcons[2]?.getAttribute('class')).not.toContain('fill-amber-400');

    await user.unhover(starTwo);
    await user.click(screen.getByRole('button', { name: 'Rate 5 stars' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Thank you for your feedback.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/activity-feed/feedback',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('requires a comment before submitting ratings below five stars', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<ActivityFeedbackRequest activity={createActivity()} />);

    await user.click(screen.getByRole('button', { name: 'Rate 3 stars' }));
    expect(
      screen.getByPlaceholderText('Tell us what could be better...'),
    ).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
    expect(submitButton).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText('Tell us what could be better...'),
      'Need a little more structure.',
    );

    expect(submitButton).toBeEnabled();
  });

  it('allows temporary re-rating after submit', async () => {
    const firstSubmittedAt = new Date().toISOString();
    const secondSubmittedAt = new Date(Date.now() + 1_000).toISOString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            submittedAt: firstSubmittedAt,
            rating: 4,
            comment: 'Need more examples.',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            submittedAt: secondSubmittedAt,
            rating: 5,
            comment: null,
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<ActivityFeedbackRequest activity={createActivity()} />);

    await user.click(screen.getByRole('button', { name: 'Rate 4 stars' }));
    await user.type(
      screen.getByPlaceholderText('Tell us what could be better...'),
      'Need more examples.',
    );
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Edit rating' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit rating' }));
    await user.click(screen.getByRole('button', { name: 'Rate 5 stars' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(screen.getByText('Thank you for your feedback.')).toBeInTheDocument();
  });

  it('removes edit access after one minute from the submitted timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T10:02:31.000Z'));

    render(
      <ActivityFeedbackRequest
        activity={createActivity({
          feedbackResponse: {
            rating: 4,
            comment: 'Need more examples.',
            submittedAt: '2026-03-16T10:01:00.000Z',
          },
        })}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByRole('button', { name: 'Edit rating' })).toBeNull();
  });

  it('does not render the feedback card for unsupported roles', () => {
    const activity = createActivity({ feedbackUiEnabled: false });

    expect(canRenderActivityFeedbackRequest(activity)).toBe(false);

    const { container } = render(<ActivityFeedbackRequest activity={activity} />);
    expect(container).toBeEmptyDOMElement();
  });
});
