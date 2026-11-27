import { cookies } from 'next/headers';
import type { ParentReferralLanding } from '@iconicedu/shared-types';
import { enableParentReferrals } from '@iconicedu/web/flags';
import { createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
import { ReferralOnboardingProvider } from '@iconicedu/web/lib/referrals/referral-onboarding-context';
import {
  isParentReferralCode,
  PARENT_REFERRAL_COOKIE,
  PARENT_REFERRAL_CANCELLED_COOKIE,
} from '@iconicedu/web/lib/referrals/referral-cookie';
export default async function CallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled = await enableParentReferrals();
  const cookieStore = await cookies();
  const rawCode = cookieStore.get(PARENT_REFERRAL_COOKIE)?.value;
  const code =
    cookieStore.get(PARENT_REFERRAL_CANCELLED_COOKIE)?.value === rawCode
      ? undefined
      : rawCode;
  let referrerName = '';
  if (enabled && isParentReferralCode(code)) {
    try {
      referrerName = (
        await createPublicApiClient().get<ParentReferralLanding>(
          `/referrals/links/${code}`,
        )
      ).referrerName;
    } catch {
      /* An expired/deactivated invitation leaves the optional name field available. */
    }
  }
  return (
    <ReferralOnboardingProvider enabled={enabled} referrerName={referrerName}>
      {children}
    </ReferralOnboardingProvider>
  );
}
