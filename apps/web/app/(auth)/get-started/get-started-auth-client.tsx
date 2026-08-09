'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { AuthEntryForm } from '@iconicedu/web/app/(auth)/shared/auth-entry-form';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import {
  buildCodeEntryPath,
  shouldCreateUserForIntent,
} from '@iconicedu/web/app/(auth)/shared/code-entry-utils';

export function resolveGetStartedCallbackUrl(): string {
  if (typeof window === 'undefined') {
    return '/auth/callback?intent=get-started&source=self-signup';
  }
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('intent', 'get-started');
  callbackUrl.searchParams.set('source', 'self-signup');
  return callbackUrl.toString();
}

type GetStartedAuthClientProps = {
  enableGoogleSignIn?: boolean;
  enableAppleSignIn?: boolean;
  recaptchaSiteKey?: string;
};

export default function GetStartedAuthClient({
  enableGoogleSignIn = false,
  enableAppleSignIn = false,
  recaptchaSiteKey,
}: GetStartedAuthClientProps) {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleEmailLogin = async (email: string, captchaToken?: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: shouldCreateUserForIntent('get-started'),
        captchaToken,
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
      }),
    );
  };

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setErrorMessage(null);
    setStatusMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: resolveGetStartedCallbackUrl(),
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
      title="Personalized tutoring for every child"
      subtitle="Book trusted 1-on-1 academic support that helps students build skills, confidence, and future readiness."
      introText=""
      trustLine="No password required. We will email you a secure one-time code."
      submitLabel="Get Started"
      submitLoadingLabel="Sending..."
      oauthActionVerb="sign-up"
      enableGoogleSignIn={enableGoogleSignIn}
      enableAppleSignIn={enableAppleSignIn}
      recaptchaSiteKey={recaptchaSiteKey}
    />
  );
}
