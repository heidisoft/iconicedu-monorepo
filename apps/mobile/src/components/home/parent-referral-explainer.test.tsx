import React from 'react';
import { Alert, Platform, Share } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ParentReferralOffer } from '@iconicedu/shared-types';
import { ParentReferralExplainer } from './parent-referral-explainer';
const mockPrepare = jest.fn();
const mockRetry = jest.fn();
let mockEnabled = true;
const mockQuery = jest.fn();
jest.mock('@/hooks/use-mobile-feature-flag', () => ({
  useMobileFeatureFlag: () => mockEnabled,
}));
let mockError = false;
let mockOffer: ParentReferralOffer | undefined;
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => {
    mockQuery(options);
    return {
      data: mockOffer,
      isPending: false,
      isError: mockError,
      refetch: mockRetry,
    };
  },
}));
jest.mock('@/lib/api/parent-referrals', () => ({
  fetchParentReferralOffer: jest.fn(),
  prepareParentReferralLink: (...args: unknown[]) => mockPrepare(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockError = false;
  mockEnabled = true;
  mockOffer = {
    rewardLabel: '$20 off',
    explanation:
      'Our team confirms the referral and arranges your $20 discount through Stripe.',
    steps: [
      'Share your invitation.',
      'Your parent friend signs up.',
      'Our team confirms your referral.',
    ],
  };
  mockPrepare.mockResolvedValue({
    ...mockOffer,
    url: `https://academy.example.invalid/r/${'a'.repeat(48)}`,
  });
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
});
afterEach(() => jest.restoreAllMocks());
it('explains the reward and manual confirmation before generating any link', () => {
  const close = jest.fn();
  render(<ParentReferralExplainer orgId="org-1" onClose={close} />);
  expect(screen.getByText('$20 off')).toBeTruthy();
  expect(screen.getByText(/Our team confirms the referral/)).toBeTruthy();
  expect(mockPrepare).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Close referral explainer'));
  expect(close).toHaveBeenCalledTimes(1);
});
it.each(['ios', 'android'] as const)(
  'shares a website invitation via the %s native share sheet',
  async (os) => {
    const replacement = jest.replaceProperty(Platform, 'OS', os);
    render(<ParentReferralExplainer orgId="org-1" onClose={jest.fn()} />);
    await act(async () =>
      fireEvent.press(screen.getByLabelText('Share parent invitation')),
    );
    expect(mockPrepare).toHaveBeenCalledWith('org-1');
    const payload = jest.mocked(Share.share).mock.calls[0]![0];
    const url = `https://academy.example.invalid/r/${'a'.repeat(48)}`;
    if (os === 'ios') expect(payload).toMatchObject({ url });
    else expect(payload.message).toContain(url);
    expect(payload.message).not.toContain('referrerAccountId');
    replacement.restore();
  },
);
it('keeps unavailable referrals from being shared and supports retry', () => {
  mockOffer = undefined;
  mockError = true;
  render(<ParentReferralExplainer orgId="org-1" onClose={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('Share parent invitation'));
  expect(mockPrepare).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Retry referral details'));
  expect(mockRetry).toHaveBeenCalledTimes(1);
});
it('handles link-generation failures without opening the share sheet', async () => {
  mockPrepare.mockRejectedValueOnce(new Error('network unavailable'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<ParentReferralExplainer orgId="org-1" onClose={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('Share parent invitation'));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith('Unable to share invitation', expect.any(String)),
  );
  expect(Share.share).not.toHaveBeenCalled();
});

it('does not open sharing after the explainer has been dismissed during link preparation', async () => {
  let resolve!: (value: object) => void;
  mockPrepare.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = render(<ParentReferralExplainer orgId="org-1" onClose={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('Share parent invitation'));
  view.unmount();
  await act(async () => {
    resolve({ url: 'https://academy.example.invalid/r/example' });
  });
  expect(Share.share).not.toHaveBeenCalled();
});

it('renders nothing and disables the offer query when the flag is off', () => {
  mockEnabled = false;
  render(<ParentReferralExplainer orgId="org-1" onClose={jest.fn()} />);
  expect(screen.queryByText('$20 off')).toBeNull();
  expect(screen.queryByLabelText('Share parent invitation')).toBeNull();
  expect(mockQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  expect(mockPrepare).not.toHaveBeenCalled();
});
it('does not share if the flag turns off while a link is being prepared', async () => {
  let resolve!: (value: object) => void;
  mockPrepare.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = render(<ParentReferralExplainer orgId="org-1" onClose={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('Share parent invitation'));
  mockEnabled = false;
  view.rerender(<ParentReferralExplainer orgId="org-1" onClose={jest.fn()} />);
  await act(async () => {
    resolve({ url: 'https://academy.example.invalid/r/example' });
  });
  expect(Share.share).not.toHaveBeenCalled();
});
