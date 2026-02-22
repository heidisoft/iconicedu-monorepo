'use client';

import * as React from 'react';

import { AuthEntryForm } from '@iconicedu/web/app/(auth)/shared/auth-entry-form';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { trackAuthTelemetry } from '@iconicedu/web/lib/telemetry/auth-events';

type OrgGetStartedClientProps = {
  orgSlug: string;
  orgName: string;
};

export function resolveOrgGetStartedCallbackUrl(orgSlug: string): string {
  if (typeof window === 'undefined') {
    return '/auth/callback?intent=get-started';
  }
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('org', orgSlug);
  callbackUrl.searchParams.set('intent', 'get-started');
  return callbackUrl.toString();
}

export default function OrgGetStartedClient({ orgSlug, orgName }: OrgGetStartedClientProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleEmailLogin = async (email: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    await trackAuthTelemetry('auth_start_email', { orgSlug, intent: 'org-get-started' });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: resolveOrgGetStartedCallbackUrl(orgSlug),
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await trackAuthTelemetry('auth_magiclink_sent', { orgSlug, intent: 'org-get-started' });
    setStatusMessage('Check your email for a secure link to continue setup.');
  };

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (provider === 'google') {
      await trackAuthTelemetry('auth_start_google', { orgSlug, intent: 'org-get-started' });
    }

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
      subtitle="Create your secure account and complete onboarding in a few guided steps."
      introText="New to this organization? Continue with your email or Google to create your account."
      trustLine="Secure login. No password required. Guided onboarding."
    />
  );
}
