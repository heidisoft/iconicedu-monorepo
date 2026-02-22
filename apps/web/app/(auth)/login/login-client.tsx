'use client';

import * as React from 'react';
import { LoginForm } from '@iconicedu/ui-web';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { trackAuthTelemetry } from '@iconicedu/web/lib/telemetry/auth-events';

export default function LoginClient() {
  const callbackUrl =
    typeof window === 'undefined'
      ? '/auth/callback'
      : `${window.location.origin}/auth/callback`;
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleEmailLogin = async (email: string) => {
    setErrorMessage(null);
    setStatusMessage(null);
    await trackAuthTelemetry('auth_start_email');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await trackAuthTelemetry('auth_magiclink_sent');
    setStatusMessage('Check your email for a login link.');
  };

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (provider === 'google') {
      await trackAuthTelemetry('auth_start_google');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <LoginForm
      onEmailLogin={handleEmailLogin}
      onOAuthLogin={handleOAuthLogin}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
    />
  );
}
