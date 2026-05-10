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

export default function GetStartedAuthClient() {
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
      title="Admin Get Started"
      subtitle="Sign in to continue admin setup. Organization creation is restricted to users without an assigned organization."
      introText="Use an administrator email. After sign-in, we will verify whether your account already belongs to an organization before showing setup actions."
      trustLine="Admin-safe flow. No password required. Organization creation is guarded."
      submitLabel="Send verification code"
      submitLoadingLabel="Sending verification code..."
      oauthActionVerb="sign-up"
    />
  );
}
