'use client';

import * as React from 'react';

import { AuthEntryForm } from '@iconicedu/web/app/(auth)/shared/auth-entry-form';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { trackAuthTelemetry } from '@iconicedu/web/lib/telemetry/auth-events';

type OrgLoginClientProps = {
  orgSlug: string;
  orgName: string;
};

export function resolveOrgLoginCallbackUrl(orgSlug: string): string {
  if (typeof window === 'undefined') {
    return '/auth/callback?intent=login';
  }
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('org', orgSlug);
  callbackUrl.searchParams.set('intent', 'login');
  return callbackUrl.toString();
}

export default function OrgLoginClient({ orgSlug, orgName }: OrgLoginClientProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleEmailLogin = async (email: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    const eligibilityResponse = await fetch('/api/accounts/login-eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        orgSlug,
        email,
      }),
    });

    const eligibilityBody = (await eligibilityResponse.json().catch(() => null)) as
      | { eligible?: boolean; message?: string }
      | null;

    if (!eligibilityResponse.ok || !eligibilityBody?.eligible) {
      setErrorMessage(
        eligibilityBody?.message ??
          'No existing account found for this organization. Use Get started instead.',
      );
      return;
    }

    await trackAuthTelemetry('auth_start_email', { orgSlug, intent: 'org-login' });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: resolveOrgLoginCallbackUrl(orgSlug),
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await trackAuthTelemetry('auth_magiclink_sent', { orgSlug, intent: 'org-login' });
    setStatusMessage('Check your email for your secure sign-in link.');
  };

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (provider === 'google') {
      await trackAuthTelemetry('auth_start_google', { orgSlug, intent: 'org-login' });
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: resolveOrgLoginCallbackUrl(orgSlug),
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
      title={`Sign in to ${orgName}`}
      subtitle="Use your existing organization account to access your dashboard."
      introText="This page is for existing users. If you are new, use the Get started page for your organization."
      trustLine="Secure login. No password required. Organization access only."
    />
  );
}
