import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { SessionCompletedCarousel } from './session-completed-carousel';

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
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps a confirmed slide for rating, then removes it after rating', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { success: true } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SessionCompletedCarousel completions={[completion]} />);

    const confirmButton = screen.getByRole('button', { name: 'Confirm Lesson' });
    const reportButton = screen.getByRole('button', { name: 'Report a Problem' });

    expect(confirmButton).toHaveAttribute('data-size', 'lg');
    expect(reportButton).toHaveAttribute('data-size', 'lg');
    expect(confirmButton).toHaveClass('flex-1');
    expect(reportButton).toHaveClass('flex-1');

    fireEvent.click(confirmButton);
    expect(await screen.findByText('Great! How was the session?')).toBeInTheDocument();
    expect(screen.getByText('Recently completed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rate 5 stars' }));

    // The rated tile holds on screen briefly (so its "Thank you" confirmation is
    // actually visible) before advancing — it must not vanish the instant the
    // rating succeeds.
    expect(await screen.findByText('Thank you for your feedback.')).toBeInTheDocument();
    expect(screen.getByText('Recently completed')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByText('Recently completed')).not.toBeInTheDocument();
      },
      { timeout: 15000 },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/session-completions/${completion.id}/confirm`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/session-completions/${completion.id}/rate`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rotates a bare-confirmed card to the back of the deck after the vote grace window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { success: true } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const second: SessionCompletionVM = {
      ...completion,
      id: '00000000-0000-4000-8000-000000000009',
      sessionTitle: 'Geometry',
    };

    render(<SessionCompletedCarousel completions={[completion, second]} />);

    // Algebra holds the front (interactive) slot.
    expect(screen.getByText('Algebra')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Lesson' }));
    expect(await screen.findByText('Great! How was the session?')).toBeInTheDocument();
    // While the confirmed card holds the front slot there is no confirm prompt.
    expect(
      screen.queryByRole('button', { name: 'Confirm Lesson' }),
    ).not.toBeInTheDocument();
    // Nothing removed — the deck still counts two cards.
    expect(screen.getByText('2')).toBeInTheDocument();

    // After the grace window the confirmed card rotates to the back and Geometry
    // takes the front slot; the count is unchanged.
    await vi.advanceTimersByTimeAsync(8000);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm Lesson' })).toBeInTheDocument();
    });
    expect(screen.getByText('Geometry')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
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
    render(<SessionCompletedCarousel completions={[confirmedUnrated, stillPending]} />);

    expect(screen.getByText('Geometry')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Lesson' })).toBeInTheDocument();
    // The confirmed card is a peeking placeholder behind — its title is not rendered.
    expect(screen.queryByText('Algebra')).not.toBeInTheDocument();
  });

  it('shows the close (×) control only once the session is confirmed', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { success: true } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SessionCompletedCarousel completions={[completion]} />);

    // Still on the confirm prompt — no way to close it yet.
    expect(
      screen.queryByRole('button', { name: 'Dismiss this session' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Lesson' }));

    expect(
      await screen.findByRole('button', { name: 'Dismiss this session' }),
    ).toBeInTheDocument();
  });

  it('removes a card, and tells the server to skip its rating, when closed', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const confirmed: SessionCompletionVM = {
      ...completion,
      status: 'confirmed',
      rating: null,
    };

    render(<SessionCompletedCarousel completions={[confirmed]} />);

    expect(screen.getByText('Recently completed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this session' }));

    await waitFor(() => {
      expect(screen.queryByText('Recently completed')).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/session-completions/${confirmed.id}/skip-rating`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('keeps a dismissed card gone across a completions prop refresh', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const confirmed: SessionCompletionVM = {
      ...completion,
      status: 'confirmed',
      rating: null,
    };

    const { rerender } = render(<SessionCompletedCarousel completions={[confirmed]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this session' }));
    await waitFor(() => {
      expect(screen.queryByText('Recently completed')).not.toBeInTheDocument();
    });

    // A re-fetch hands the carousel a brand-new array carrying the same row.
    rerender(<SessionCompletedCarousel completions={[{ ...confirmed }]} />);

    expect(screen.queryByText('Recently completed')).not.toBeInTheDocument();
  });
});
