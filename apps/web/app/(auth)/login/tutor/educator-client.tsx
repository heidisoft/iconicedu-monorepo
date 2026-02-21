'use client';

import * as React from 'react';
import { Button } from '@iconicedu/ui-web';
import { LoginForm } from '@iconicedu/ui-web';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { educatorSignupAction } from '@iconicedu/web/app/(auth)/login/tutor/actions/educator-signup';
import { trackAuthTelemetry } from '@iconicedu/web/lib/telemetry/auth-events';

export default function EducatorAuthClient() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [signupState, setSignupState] = React.useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    displayName: '',
  });
  const [signupMessage, setSignupMessage] = React.useState<string | null>(null);
  const [signupError, setSignupError] = React.useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = React.useState(false);

  const handleEmailLogin = async (email: string) => {
    setErrorMessage(null);
    setStatusMessage(null);
    await trackAuthTelemetry('auth_start_email', { roleIntent: 'educator' });
    const redirectTo = `${window.location.origin}/auth/callback?educator=1`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await trackAuthTelemetry('auth_magiclink_sent', { roleIntent: 'educator' });
    setStatusMessage('Check your email for a login link.');
  };

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (provider === 'google') {
      await trackAuthTelemetry('auth_start_google', { roleIntent: 'educator' });
    }
    const redirectTo = `${window.location.origin}/auth/callback?educator=1`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    }
  };

  const handleSignup = async () => {
    setSignupError(null);
    setSignupMessage(null);
    if (
      !signupState.email ||
      !signupState.password ||
      !signupState.firstName ||
      !signupState.lastName
    ) {
      setSignupError('Please complete all required fields.');
      return;
    }
    setIsSigningUp(true);
    try {
      await educatorSignupAction({
        email: signupState.email,
        password: signupState.password,
        firstName: signupState.firstName,
        lastName: signupState.lastName,
        displayName: signupState.displayName,
      });
      setSignupMessage('Educator account created. Please log in with the same email.');
      setSignupState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        displayName: '',
      });
    } catch (error) {
      setSignupError(error instanceof Error ? error.message : 'Unable to create account');
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <LoginForm
        onEmailLogin={handleEmailLogin}
        onOAuthLogin={handleOAuthLogin}
        statusMessage={statusMessage}
        errorMessage={errorMessage}
      />
    </div>
  );
}
