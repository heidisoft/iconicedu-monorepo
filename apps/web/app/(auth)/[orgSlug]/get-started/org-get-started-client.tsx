'use client';

import {
  activeReferralCode,
  markReferralFlow,
} from '@iconicedu/web/lib/referrals/referral-exit';
import * as React from 'react';
import { useRouter } from 'next/navigation';

import { AuthEntryForm } from '@iconicedu/web/app/(auth)/shared/auth-entry-form';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import {
  buildCodeEntryPath,
  shouldCreateUserForIntent,
} from '@iconicedu/web/app/(auth)/shared/code-entry-utils';

type OrgGetStartedClientProps = {
  orgSlug: string;
  orgName: string;
  initialEmail?: string;
  initialReferralCode?: string;
  enableGoogleSignIn?: boolean;
  enableAppleSignIn?: boolean;
};

export function resolveOrgGetStartedCallbackUrl(
  orgSlug: string,
  referralCode?: string,
): string {
  if (typeof window === 'undefined') {
    return '/auth/callback?intent=get-started&source=self-signup';
  }
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('org', orgSlug);
  callbackUrl.searchParams.set('intent', 'get-started');
  callbackUrl.searchParams.set('source', 'self-signup');
  if (referralCode) callbackUrl.searchParams.set('referral', referralCode);
  return callbackUrl.toString();
}

export default function OrgGetStartedClient({
  orgSlug,
  orgName,
  initialEmail,
  initialReferralCode,
  enableGoogleSignIn = false,
  enableAppleSignIn = false,
}: OrgGetStartedClientProps) {
  const router = useRouter();
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleEmailLogin = async (email: string, captchaToken: string | null) => {
    setErrorMessage(null);
    setStatusMessage(null);

    const referralCode = activeReferralCode(initialReferralCode);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        ...(referralCode
          ? {
              emailRedirectTo: resolveOrgGetStartedCallbackUrl(orgSlug, referralCode),
            }
          : {}),
        shouldCreateUser: shouldCreateUserForIntent('get-started'),
        captchaToken: captchaToken ?? undefined,
      },
    });

    if (!mounted.current) return;
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (referralCode && activeReferralCode(referralCode))
      markReferralFlow(referralCode, 'verifying');
    router.replace(
      buildCodeEntryPath({
        email,
        intent: 'get-started',
        orgSlug,
      }),
    );
  };

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setErrorMessage(null);
    setStatusMessage(null);
    const referralCode = activeReferralCode(initialReferralCode);
    if (referralCode) markReferralFlow(referralCode, 'verifying');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: resolveOrgGetStartedCallbackUrl(orgSlug, referralCode),
      },
    });

    if (error) {
      if (referralCode) markReferralFlow(referralCode, 'signup');
      setErrorMessage(error.message);
    }
  };

  return (
    <AuthEntryForm
      onEmailLogin={handleEmailLogin}
      onOAuthLogin={handleOAuthLogin}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      initialEmail={initialEmail}
      title="Personalized tutoring for every child"
      subtitle="Book trusted 1-on-1 academic support that helps students build skills, confidence, and future readiness."
      introText=""
      trustLine={`Create your account to get started with ${orgName}.`}
      oauthActionVerb="sign-up"
      enableGoogleSignIn={enableGoogleSignIn}
      enableAppleSignIn={enableAppleSignIn}
      submitLabel="Get Started"
      submitLoadingLabel="Sending..."
      footerLinkIntro="Already have an account?"
      footerLinkLabel="Log in here"
      footerLinkHref={`/${orgSlug}/login`}
    />
  );
}
