import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ path: '/r/invitation' }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.path }));
import { WebReferralFlowBoundary } from './referral-flow-boundary';
import {
  activeReferralCode,
  cancelReferralFlow,
  markReferralFlow,
  readReferralFlow,
} from './referral-exit';
const code = 'a'.repeat(48);
beforeEach(() => {
  sessionStorage.clear();
  mocks.path = '/r/invitation';
  vi.stubGlobal('navigator', { sendBeacon: vi.fn().mockReturnValue(true) });
});
afterEach(() => vi.unstubAllGlobals());
it('clears an invitation when navigating away without accepting', () => {
  markReferralFlow(code, 'invitation');
  const view = render(<WebReferralFlowBoundary />);
  mocks.path = '/';
  view.rerender(<WebReferralFlowBoundary />);
  expect(readReferralFlow()?.phase).toBe('cancelled');
  expect(navigator.sendBeacon).toHaveBeenCalledWith(
    '/api/referrals/cancel',
    JSON.stringify({ code }),
  );
});
it('preserves the accepted signup and verification steps, but clears when backing out', () => {
  markReferralFlow(code, 'signup');
  mocks.path = '/academy/get-started';
  const view = render(<WebReferralFlowBoundary />);
  expect(activeReferralCode(code)).toBe(code);
  markReferralFlow(code, 'verifying');
  mocks.path = '/code';
  view.rerender(<WebReferralFlowBoundary />);
  expect(activeReferralCode(code)).toBe(code);
  mocks.path = '/academy/get-started';
  view.rerender(<WebReferralFlowBoundary />);
  expect(activeReferralCode(code)).toBeUndefined();
});
it('does nothing to an ordinary signup without referral state', () => {
  mocks.path = '/academy/get-started';
  render(<WebReferralFlowBoundary />);
  expect(navigator.sendBeacon).not.toHaveBeenCalled();
  expect(activeReferralCode()).toBeUndefined();
});
it('uses a caught keepalive fallback when sendBeacon fails', async () => {
  vi.stubGlobal('navigator', { sendBeacon: () => false });
  const request = vi.fn().mockRejectedValue(new Error('Offline'));
  vi.stubGlobal('fetch', request);
  expect(() => cancelReferralFlow(code)).not.toThrow();
  await Promise.resolve();
  expect(activeReferralCode(code)).toBeUndefined();
  expect(request).toHaveBeenCalledWith(
    '/api/referrals/cancel',
    expect.objectContaining({ keepalive: true, credentials: 'same-origin' }),
  );
});
it('permits a later explicit acceptance after cancellation', () => {
  cancelReferralFlow(code);
  markReferralFlow(code, 'signup');
  expect(activeReferralCode(code)).toBe(code);
});
