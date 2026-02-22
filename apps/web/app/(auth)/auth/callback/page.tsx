'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { trackAuthTelemetry } from '@iconicedu/web/lib/telemetry/auth-events';

type SupportedOtpType = 'magiclink' | 'invite' | 'signup';

function resolveOtpType(value?: string | null): SupportedOtpType {
  if (value === 'magiclink' || value === 'invite' || value === 'signup') {
    return value;
  }
  if (value === 'invitation') {
    return 'invite';
  }
  return 'invite';
}

export default function CallbackPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [loadingMessage, setLoadingMessage] = React.useState('Logging you in…');
  const [pageError, setPageError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    const type = resolveOtpType(searchParams.get('type'));
    const isEducatorFlow = searchParams.get('educator') === '1';
    const requestedOrgSlug = searchParams.get('org')?.trim().toLowerCase() ?? '';
    const authIntentRaw = searchParams.get('intent');
    const authIntent =
      authIntentRaw === 'login' || authIntentRaw === 'get-started'
        ? authIntentRaw
        : null;

    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash,
    );
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    const activateAccount = async () => {
      try {
        const activationParams = new URLSearchParams();
        if (requestedOrgSlug) {
          activationParams.set('org', requestedOrgSlug);
        }
        if (authIntent) {
          activationParams.set('intent', authIntent);
        }
        const activationPath = activationParams.size
          ? `/api/accounts/activate?${activationParams.toString()}`
          : '/api/accounts/activate';
        const response = await fetch(activationPath, {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (!response.ok) return null;
        const body = (await response.json().catch(() => null)) as
          | {
              onboarding?: {
                requiresOrgSetup?: boolean;
                requiresRoleSelection: boolean;
                destination: string | null;
              };
            }
          | null;
        return body?.onboarding ?? null;
      } catch (error) {
        console.error('Failed to activate account after auth callback', error);
        return null;
      }
    };

    const applyOnboardingState = async (onboarding: {
      requiresOrgSetup?: boolean;
      requiresRoleSelection: boolean;
      destination: string | null;
    } | null) => {
      if (onboarding?.requiresOrgSetup) {
        router.replace(
          onboarding.destination ??
            (requestedOrgSlug ? `/${requestedOrgSlug}/get-started` : '/get-started'),
        );
        return;
      }
      if (onboarding?.requiresRoleSelection) {
        router.replace(
          onboarding.destination ??
            (requestedOrgSlug ? `/${requestedOrgSlug}/login` : '/get-started'),
        );
        return;
      }
      router.replace(onboarding?.destination ?? '/get-started');
    };

    const finish = async () => {
      try {
        setPageError(null);
        setLoadingMessage('Logging you in…');
        if (isEducatorFlow) {
          document.cookie =
            'profile_kind_override=educator; path=/; max-age=60; sameSite=Lax;';
        }
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          await trackAuthTelemetry('auth_success', { method: 'oauth-or-magiclink-code' });
          const onboarding = await activateAccount();
          await applyOnboardingState(onboarding);
          return;
        }

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          await trackAuthTelemetry('auth_success', { method: 'token_hash' });
          const onboarding = await activateAccount();
          await applyOnboardingState(onboarding);
          return;
        }

        if (token) {
          await supabase.auth.verifyOtp({
            token_hash: token,
            type,
          });
          await trackAuthTelemetry('auth_success', { method: 'otp-token' });
          const onboarding = await activateAccount();
          await applyOnboardingState(onboarding);
          return;
        }

        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          if (requestedOrgSlug) {
            const fallbackPath =
              authIntent === 'get-started'
                ? `/${requestedOrgSlug}/get-started`
                : `/${requestedOrgSlug}/login`;
            router.replace(fallbackPath);
            return;
          }
          router.replace('/login');
          return;
        }

        const onboarding = await activateAccount();
        await applyOnboardingState(onboarding);
      } catch (error) {
        console.error('Failed to complete auth callback', error);
        setPageError('Unable to complete login. Please try again.');
      }
    };

    void finish();
  }, [router, supabase]);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{pageError ?? loadingMessage}</p>
    </div>
  );
}
