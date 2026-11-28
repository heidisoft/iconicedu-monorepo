'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cancelReferralFlow, readReferralFlow } from './referral-exit';

export function WebReferralFlowBoundary() {
  const path = usePathname();
  useEffect(() => {
    const flow = readReferralFlow();
    if (!flow || flow.phase === 'cancelled') return;
    const invitation = path.startsWith('/r/');
    const signup = path.endsWith('/get-started');
    const verification = path === '/code' || path.startsWith('/auth/callback');
    if (
      (!invitation && !signup && !verification) ||
      (flow.phase === 'invitation' && !invitation) ||
      (flow.phase === 'verifying' && signup)
    )
      cancelReferralFlow(flow.code);
  }, [path]);
  return null;
}
