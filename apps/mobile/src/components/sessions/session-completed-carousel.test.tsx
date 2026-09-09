import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { lightColors } from '@/lib/theme';
import { SessionCompletedCarousel } from './session-completed-carousel';
import {
  confirmSessionCompletion,
  rateSessionCompletion,
  skipSessionCompletionRating,
} from '@/lib/api/session-completions';

jest.mock('@/lib/api/session-completions', () => ({
  confirmSessionCompletion: jest.fn(async () => ({
    success: true,
    feedbackEnabled: true,
  })),
  disputeSessionCompletion: jest.fn(async () => ({
    success: true,
    feedbackEnabled: false,
  })),
  rateSessionCompletion: jest.fn(async () => ({ success: true })),
  skipSessionCompletionRating: jest.fn(async () => ({ success: true })),
}));

const completion: SessionCompletionVM = {
  id: '00000000-0000-4000-8000-000000000001',
  orgId: '00000000-0000-4000-8000-000000000002',
  scheduleId: '00000000-0000-4000-8000-000000000003',
  occurrenceKey: '2026-09-04T15:00:00.000Z',
  profileId: '00000000-0000-4000-8000-000000000004',
  role: 'child',
  status: 'pending',
  disputeCategory: null,
  disputeReason: null,
  rescheduleRequested: false,
  rating: null,
  ratingComment: null,
  channelId: null,
  learningSpaceId: null,
  sessionTitle: 'Algebra',
  sessionEndAt: '2026-09-04T16:00:00.000Z',
  notifiedAt: '2026-09-04T16:10:00.000Z',
  confirmedAt: null,
  disputedAt: null,
  ratedAt: null,
  resolvedAt: null,
  expiresAt: '2026-09-07T16:00:00.000Z',
};

describe('SessionCompletedCarousel', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a confirmed card for rating, then removes it after rating', async () => {
    render(<SessionCompletedCarousel sessions={[completion]} colors={lightColors} />);

    fireEvent.press(screen.getByLabelText('Confirm lesson'));
    expect(await screen.findByText('Great! How was the session?')).toBeTruthy();
    expect(confirmSessionCompletion).toHaveBeenCalledWith({
      orgId: completion.orgId,
      sessionCompletionId: completion.id,
    });

    fireEvent.press(screen.getByLabelText('Rate 5 stars'));

    // The rated card holds on screen briefly (so its "Thank you" confirmation is
    // actually visible) before advancing — it must not vanish the instant the
    // rating succeeds.
    expect(await screen.findByText('Thank you for your feedback.')).toBeTruthy();
    expect(screen.getByText('Recently completed')).toBeTruthy();

    await waitFor(
      () => {
        expect(screen.queryByText('Recently completed')).toBeNull();
      },
      { timeout: 15000 },
    );
    expect(rateSessionCompletion).toHaveBeenCalledWith({
      orgId: completion.orgId,
      sessionCompletionId: completion.id,
      rating: 5,
      comment: null,
    });
  });

  it('rotates a bare-confirmed card to the back of the deck after the vote grace window', async () => {
    jest.useFakeTimers();

    const second: SessionCompletionVM = {
      ...completion,
      id: '00000000-0000-4000-8000-000000000009',
      sessionTitle: 'Geometry',
    };

    render(
      <SessionCompletedCarousel sessions={[completion, second]} colors={lightColors} />,
    );

    // Algebra holds the front (interactive) slot.
    expect(screen.getByText('Algebra')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Confirm lesson'));
    });
    expect(await screen.findByText('Great! How was the session?')).toBeTruthy();
    // No confirm prompt while the confirmed card holds the front slot.
    expect(screen.queryByLabelText('Confirm lesson')).toBeNull();
    // Nothing removed — the deck still counts two cards.
    expect(screen.getByText('2')).toBeTruthy();

    // After the grace window the confirmed card rotates to the back and Geometry
    // takes the front slot; the count is unchanged.
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });

    expect(screen.getByLabelText('Confirm lesson')).toBeTruthy();
    expect(screen.getByText('Geometry')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('orders confirmed-but-unrated cards to the bottom of the deck', () => {
    const confirmedUnrated: SessionCompletionVM = {
      ...completion,
      id: '00000000-0000-4000-8000-00000000000a',
      status: 'confirmed',
      rating: null,
      sessionTitle: 'Algebra',
    };
    const stillPending: SessionCompletionVM = {
      ...completion,
      id: '00000000-0000-4000-8000-00000000000b',
      status: 'pending',
      sessionTitle: 'Geometry',
    };

    // Confirmed one is first in the incoming list, but it should sink behind the
    // pending one so the actionable card is up front.
    render(
      <SessionCompletedCarousel
        sessions={[confirmedUnrated, stillPending]}
        colors={lightColors}
      />,
    );

    expect(screen.getByText('Geometry')).toBeTruthy();
    expect(screen.getByLabelText('Confirm lesson')).toBeTruthy();
    // The confirmed card is a peeking placeholder behind — its title is not rendered.
    expect(screen.queryByText('Algebra')).toBeNull();
  });

  it('shows the close (×) control only once the session is confirmed', async () => {
    render(<SessionCompletedCarousel sessions={[completion]} colors={lightColors} />);

    // Still on the confirm prompt — no way to close it yet.
    expect(screen.queryByLabelText('Dismiss this session')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Confirm lesson'));
    });

    expect(await screen.findByLabelText('Dismiss this session')).toBeTruthy();
  });

  it('removes a card, and tells the server to skip its rating, when closed', async () => {
    const confirmed: SessionCompletionVM = {
      ...completion,
      status: 'confirmed',
      rating: null,
    };

    render(<SessionCompletedCarousel sessions={[confirmed]} colors={lightColors} />);

    expect(screen.getByText('Recently completed')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Dismiss this session'));
    });

    await waitFor(() => {
      expect(screen.queryByText('Recently completed')).toBeNull();
    });
    expect(skipSessionCompletionRating).toHaveBeenCalledWith({
      orgId: confirmed.orgId,
      sessionCompletionId: confirmed.id,
    });
  });

  it('keeps a dismissed card gone across a sessions prop refresh', async () => {
    const confirmed: SessionCompletionVM = {
      ...completion,
      status: 'confirmed',
      rating: null,
    };

    const { rerender } = render(
      <SessionCompletedCarousel sessions={[confirmed]} colors={lightColors} />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Dismiss this session'));
    });
    await waitFor(() => {
      expect(screen.queryByText('Recently completed')).toBeNull();
    });

    // A re-fetch hands the carousel a brand-new array carrying the same row.
    rerender(
      <SessionCompletedCarousel sessions={[{ ...confirmed }]} colors={lightColors} />,
    );

    expect(screen.queryByText('Recently completed')).toBeNull();
  });
});
