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
  });

  it('keeps a confirmed slide for rating, then removes it after rating', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { success: true } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SessionCompletedCarousel completions={[completion]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Lesson' }));
    expect(await screen.findByText('Great! How was the session?')).toBeInTheDocument();
    expect(screen.getByText('Session Completed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rate 5 stars' }));

    await waitFor(() => {
      expect(screen.queryByText('Session Completed')).not.toBeInTheDocument();
    });
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
});
