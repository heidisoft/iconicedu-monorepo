import { ApiError } from '@/lib/api/http-client';
import { resolveParentReferral } from '@/lib/api/parent-referrals';
import { completeParentRole } from '@/lib/api/onboarding/queries';
import {
  readPendingParentReferral,
  clearPendingParentReferral,
} from './pending-referral';

/** A confirmed invitation survives authentication and is consumed only after a successful API write. */
export async function completePendingReferralSignup(userId: string) {
  const pending = await readPendingParentReferral(userId);
  if (!pending) return null;
  try {
    // Recheck the server gate and invitation validity before creating a parent account.
    await resolveParentReferral(pending.code);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      await clearPendingParentReferral({ code: pending.code, ownerId: userId });
      return 'unavailable' as const;
    }
    throw error;
  }
  const current = await readPendingParentReferral(userId);
  if (!current || current.code !== pending.code || current.savedAt !== pending.savedAt)
    return 'cancelled' as const;
  const result = await completeParentRole({ referralCode: pending.code });
  await clearPendingParentReferral({ code: pending.code, ownerId: userId });
  return result?.referralStatus ?? 'pending_review';
}
