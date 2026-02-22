'use client';

import * as React from 'react';

import { AuthEntryForm } from '@iconicedu/web/app/(auth)/shared/auth-entry-form';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { trackAuthTelemetry } from '@iconicedu/web/lib/telemetry/auth-events';

export function resolveGetStartedCallbackUrl(): string {
  if (typeof window === 'undefined') {
    return '/auth/callback?intent=get-started';
  }
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('intent', 'get-started');
  return callbackUrl.toString();
}

export default function GetStartedAuthClient() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleEmailLogin = async (email: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    await trackAuthTelemetry('auth_start_email', { intent: 'global-get-started' });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: resolveGetStartedCallbackUrl(),
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await trackAuthTelemetry('auth_magiclink_sent', { intent: 'global-get-started' });
    setStatusMessage('Admin check: use this same browser session to continue organization setup.');
  };

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (provider === 'google') {
      await trackAuthTelemetry('auth_start_google', { intent: 'global-get-started' });
    }

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
      submitLabel="Send secure admin link"
      submitLoadingLabel="Sending secure admin link..."
    />
  );
}
