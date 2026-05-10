'use client';

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
};

export function resolveOrgGetStartedCallbackUrl(orgSlug: string): string {
  if (typeof window === 'undefined') {
    return '/auth/callback?intent=get-started&source=self-signup';
  }
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('org', orgSlug);
  callbackUrl.searchParams.set('intent', 'get-started');
  callbackUrl.searchParams.set('source', 'self-signup');
  return callbackUrl.toString();
}

export default function OrgGetStartedClient({
  orgSlug,
  orgName,
}: OrgGetStartedClientProps) {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleEmailLogin = async (email: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: shouldCreateUserForIntent('get-started'),
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: resolveOrgGetStartedCallbackUrl(orgSlug),
      },
    });

    if (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <AuthEntryForm
      onEmailLogin={handleEmailLogin}
      onOAuthLogin={handleOAuthLogin}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      title={`Get started with ${orgName}`}
      subtitle="Create your secure account with your email or Google and complete onboarding in a few guided steps."
      introText=""
      trustLine="Create your account to get started with guided onboarding for your organization."
      oauthActionVerb="sign-up"
      submitLabel="Send verification code"
      submitLoadingLabel="Sending verification code..."
      footerLinkIntro="Already have an account?"
      footerLinkLabel="Log in here"
      footerLinkHref={`/${orgSlug}/login`}
    />
  );
}
