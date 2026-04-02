'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AuthEntryForm } from '../../shared/auth-entry-form';
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client';
import { trackAuthTelemetry } from '../../../../lib/telemetry/auth-events';
import {
  buildCodeEntryPath,
  shouldCreateUserForIntent,
} from '../../shared/code-entry-utils';

type OrgLoginClientProps = {
  orgSlug: string;
  orgName: string;
  loginReason?: 'session-expired' | null;
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

export function shouldPromptOrgSignUp(
  eligibility: { eligible?: boolean; reason?: string } | null,
): boolean {
  return (
    !eligibility?.eligible &&
    (eligibility?.reason === 'missing_account' ||
      eligibility?.reason === 'signup_required')
  );
}

export default function OrgLoginClient({
  orgSlug,
  orgName,
  loginReason = null,
}: OrgLoginClientProps) {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<React.ReactNode | null>(null);

  React.useEffect(() => {
    document.cookie =
      'web_incomplete_onboarding_reauth=; path=/; max-age=0; SameSite=Lax;';
  }, []);

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

    const eligibilityBody = (await eligibilityResponse.json().catch(() => null)) as {
      eligible?: boolean;
      reason?: string;
      message?: string;
    } | null;

    if (!eligibilityResponse.ok || !eligibilityBody?.eligible) {
      if (shouldPromptOrgSignUp(eligibilityBody)) {
        setErrorMessage(
          <>
            No account was found for this organization. Please{' '}
            <Link
              href={`/${orgSlug}/get-started`}
              className="underline underline-offset-4"
            >
              sign up
            </Link>{' '}
            to continue.
          </>,
        );
        return;
      }
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
        shouldCreateUser: shouldCreateUserForIntent('login'),
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await trackAuthTelemetry('auth_magiclink_sent', { orgSlug, intent: 'org-login' });
    router.replace(
      buildCodeEntryPath({
        email,
        intent: 'login',
        orgSlug,
      }),
    );
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
      subtitle={
        loginReason === 'session-expired'
          ? 'Your session expired because onboarding was not completed. Sign in again to continue setup.'
          : 'Use your existing organization account to access your dashboard.'
      }
      introText=""
      trustLine="Secure login. No password required. Organization access only."
      submitLabel="Send verification code"
      submitLoadingLabel="Sending verification code..."
      footerLinkIntro="New to ICONIC Academy?"
      footerLinkLabel="Get started here"
      footerLinkHref={`/${orgSlug}/get-started`}
    />
  );
}
