import { useEffect, useRef } from 'react';
import { useSegments, usePathname } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import {
  clearPendingParentReferral,
  consumeParentReferralSignupHandoff,
} from '@/lib/referrals/pending-referral';

/** Clear abandoned invitations, but preserve the deliberate invitation → authentication handoff. */
export function ReferralFlowBoundary() {
  const route = useSegments().join('/');
  const pathname = usePathname();
  const { session } = useAuth();
  const previous = useRef<{ route: string; pathname: string } | null>(null);
  useEffect(() => {
    const previousRoute = previous.current;
    previous.current = { route, pathname };
    if (!previousRoute) {
      consumeParentReferralSignupHandoff();
      return;
    }
    const last = previousRoute.route;
    if (last === route && previousRoute.pathname === pathname) return;
    const leftInvitation = last.startsWith('r/');
    const authFlow = route.startsWith('(auth)/') || route.startsWith('auth/callback');
    const acceptedHandoff =
      leftInvitation &&
      consumeParentReferralSignupHandoff() &&
      (authFlow || route.startsWith('(app)/'));
    const cancelledVerification =
      last === '(auth)/otp' && route === '(auth)/login' && !session;
    const leftSignup =
      last === '(auth)/profile-setup' ||
      (last.startsWith('(auth)/') && !authFlow && !session);
    if ((leftInvitation && !acceptedHandoff) || cancelledVerification || leftSignup) {
      // Invalidation is synchronous. Storage deletion is serialized with in-flight saves.
      void clearPendingParentReferral().catch(() => {
        /* Failed deletion is invalidated in memory and retried on the next read. */
      });
    }
  }, [route, pathname, session]);
  return null;
}
