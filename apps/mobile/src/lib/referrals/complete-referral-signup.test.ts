import { ApiError } from '@/lib/api/http-client';
import { resolveParentReferral } from '@/lib/api/parent-referrals';
import { completeParentRole } from '@/lib/api/onboarding/queries';
import {
  readPendingParentReferral,
  clearPendingParentReferral,
} from './pending-referral';
import { completePendingReferralSignup } from './complete-referral-signup';
jest.mock('@/lib/supabase/client', () => ({ supabase: {} }));
jest.mock('@/lib/api/parent-referrals', () => ({ resolveParentReferral: jest.fn() }));
jest.mock('@/lib/api/onboarding/queries', () => ({ completeParentRole: jest.fn() }));
jest.mock('./pending-referral', () => ({
  readPendingParentReferral: jest.fn(),
  clearPendingParentReferral: jest.fn(),
}));
const code = 'a'.repeat(48);
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(readPendingParentReferral)
    .mockResolvedValue({ code, ownerId: 'parent', savedAt: Date.now() });
  jest.mocked(resolveParentReferral).mockResolvedValue({
    orgSlug: 'academy',
    referrerName: 'Test Parent',
    rewardLabel: '$20 off',
    explanation: '',
    steps: [],
  });
  jest.mocked(completeParentRole).mockResolvedValue({ referralStatus: 'pending_review' });
});
it('carries the verified invitation into parent signup and clears it only after the write succeeds', async () => {
  expect(await completePendingReferralSignup('parent')).toBe('pending_review');
  expect(readPendingParentReferral).toHaveBeenCalledWith('parent');
  expect(completeParentRole).toHaveBeenCalledWith({ referralCode: code });
  expect(clearPendingParentReferral).toHaveBeenCalledTimes(1);
});
it('leaves ordinary signup untouched without an invitation', async () => {
  jest.mocked(readPendingParentReferral).mockResolvedValue(null);
  expect(await completePendingReferralSignup('parent')).toBeNull();
  expect(resolveParentReferral).not.toHaveBeenCalled();
  expect(completeParentRole).not.toHaveBeenCalled();
});
it.each(['lookup', 'write'])(
  'preserves the invitation on a transient %s failure',
  async (stage) => {
    (stage === 'lookup'
      ? jest.mocked(resolveParentReferral)
      : jest.mocked(completeParentRole)
    ).mockRejectedValueOnce(new Error('Offline'));
    await expect(completePendingReferralSignup('parent')).rejects.toThrow('Offline');
    expect(clearPendingParentReferral).not.toHaveBeenCalled();
  },
);
it('removes a revoked or disabled invitation without claiming a reward or blocking ordinary signup', async () => {
  jest
    .mocked(resolveParentReferral)
    .mockRejectedValueOnce(new ApiError('Unavailable', 404));
  expect(await completePendingReferralSignup('parent')).toBe('unavailable');
  expect(clearPendingParentReferral).toHaveBeenCalledTimes(1);
  expect(completeParentRole).not.toHaveBeenCalled();
});
it('reports existing-account ineligibility instead of promising a credit', async () => {
  jest
    .mocked(completeParentRole)
    .mockResolvedValueOnce({ referralStatus: 'not_eligible' });
  expect(await completePendingReferralSignup('parent')).toBe('not_eligible');
});

it('acknowledges a retried signup whose reward was already recorded', async () => {
  jest
    .mocked(completeParentRole)
    .mockResolvedValueOnce({ referralStatus: 'already_recorded' });
  expect(await completePendingReferralSignup('parent')).toBe('already_recorded');
  expect(clearPendingParentReferral).toHaveBeenCalledTimes(1);
});

it('does not start an attribution write if the invitation was cancelled during its lookup', async () => {
  jest
    .mocked(readPendingParentReferral)
    .mockResolvedValueOnce({ code, ownerId: 'parent', savedAt: Date.now() })
    .mockResolvedValueOnce(null);
  expect(await completePendingReferralSignup('parent')).toBe('cancelled');
  expect(completeParentRole).not.toHaveBeenCalled();
});
