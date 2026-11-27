import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ReferralFlowBoundary } from './referral-flow-boundary';
let mockRoute = ['r', '[code]'];
let mockPath = '/r/code';
let mockSession: object | null = null;
let mockHandoff = false;
const mockClear = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => mockRoute,
  usePathname: () => mockPath,
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: mockSession }),
}));
jest.mock('@/lib/referrals/pending-referral', () => ({
  clearPendingParentReferral: () => mockClear(),
  consumeParentReferralSignupHandoff: () => {
    const value = mockHandoff;
    mockHandoff = false;
    return value;
  },
}));
beforeEach(() => {
  mockRoute = ['r', '[code]'];
  mockPath = '/r/code';
  mockSession = null;
  mockHandoff = false;
  mockClear.mockReset().mockResolvedValue(undefined);
});
it('clears an invitation on a back/navigation exit without an acceptance', async () => {
  const view = render(<ReferralFlowBoundary />);
  mockRoute = ['(auth)', 'login'];
  mockPath = '/login';
  view.rerender(<ReferralFlowBoundary />);
  await waitFor(() => expect(mockClear).toHaveBeenCalledTimes(1));
});
it('keeps the explicitly accepted invitation through login and OTP navigation', () => {
  const view = render(<ReferralFlowBoundary />);
  mockHandoff = true;
  mockRoute = ['(auth)', 'login'];
  mockPath = '/login';
  view.rerender(<ReferralFlowBoundary />);
  mockRoute = ['(auth)', 'otp'];
  mockPath = '/otp';
  view.rerender(<ReferralFlowBoundary />);
  expect(mockClear).not.toHaveBeenCalled();
});
it('clears when email verification is abandoned back to login', async () => {
  mockRoute = ['(auth)', 'otp'];
  mockPath = '/otp';
  const view = render(<ReferralFlowBoundary />);
  mockRoute = ['(auth)', 'login'];
  mockPath = '/login';
  view.rerender(<ReferralFlowBoundary />);
  await waitFor(() => expect(mockClear).toHaveBeenCalledTimes(1));
});
it('keeps the authenticated OTP handoff to onboarding', () => {
  mockRoute = ['(auth)', 'otp'];
  mockPath = '/otp';
  const view = render(<ReferralFlowBoundary />);
  mockSession = {};
  mockRoute = ['(auth)', 'profile-setup'];
  mockPath = '/profile-setup';
  view.rerender(<ReferralFlowBoundary />);
  expect(mockClear).not.toHaveBeenCalled();
});
it('clears the prior invitation when moving to a different invitation', async () => {
  const view = render(<ReferralFlowBoundary />);
  mockPath = '/r/different';
  view.rerender(<ReferralFlowBoundary />);
  await waitFor(() => expect(mockClear).toHaveBeenCalledTimes(1));
});
it('does not crash when cancellation storage fails during navigation', async () => {
  mockClear.mockRejectedValueOnce(new Error('Storage unavailable'));
  const view = render(<ReferralFlowBoundary />);
  mockRoute = ['(auth)', 'login'];
  mockPath = '/login';
  view.rerender(<ReferralFlowBoundary />);
  await waitFor(() => expect(mockClear).toHaveBeenCalled());
});
