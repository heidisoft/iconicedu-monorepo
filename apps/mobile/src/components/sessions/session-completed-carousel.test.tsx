import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { lightColors } from '@/lib/theme';
import { SessionCompletedCarousel } from './session-completed-carousel';
import {
  confirmSessionCompletion,
  rateSessionCompletion,
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
  it('keeps a confirmed card for rating, then removes it after rating', async () => {
    render(
      <SessionCompletedCarousel
        sessions={[completion]}
        colors={lightColors}
        width={320}
      />,
    );

    fireEvent.press(screen.getByLabelText('Confirm lesson'));
    expect(await screen.findByText('Great! How was the session?')).toBeTruthy();
    expect(confirmSessionCompletion).toHaveBeenCalledWith({
      orgId: completion.orgId,
      sessionCompletionId: completion.id,
    });

    fireEvent.press(screen.getByLabelText('Rate 5 stars'));

    await waitFor(() => {
      expect(screen.queryByLabelText('Session Completed')).toBeNull();
    });
    expect(rateSessionCompletion).toHaveBeenCalledWith({
      orgId: completion.orgId,
      sessionCompletionId: completion.id,
      rating: 5,
      comment: null,
    });
  });
});
