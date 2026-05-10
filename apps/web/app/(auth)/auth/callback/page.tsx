'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { shouldSkipCallbackRun } from '@iconicedu/web/app/(auth)/auth/callback/callback-run-guard';
import { shouldShowRoleOnboardingDialog } from '@iconicedu/web/app/(auth)/auth/callback/page.utils';
import { RoleOnboardingModal } from '@iconicedu/web/app/(auth)/auth/callback/role-onboarding-modal';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { reportWebObservedError } from '@iconicedu/web/lib/analytics/report-error';

type SupportedOtpType = 'email' | 'invite';
type AuthCallbackSource = 'self-signup' | null;

function resolveOtpType(value?: string | null): SupportedOtpType {
  if (value === 'invite' || value === 'invitation') {
    return 'invite';
  }
  if (value === 'email' || value === 'magiclink' || value === 'signup') {
    return 'email';
  }
  return 'email';
}

function resolveCallbackSource(value?: string | null): AuthCallbackSource {
  return value === 'self-signup' ? 'self-signup' : null;
}

export default function CallbackPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [loadingMessage, setLoadingMessage] = React.useState('Logging you in…');
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [roleOnboardingState, setRoleOnboardingState] = React.useState<{
    orgSlug: string | null;
    fallbackDestination: string;
    intent: 'login' | 'get-started' | null;
  } | null>(null);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    const type = resolveOtpType(searchParams.get('type'));
    const isEducatorFlow = searchParams.get('educator') === '1';
    const requestedOrgSlug = searchParams.get('org')?.trim().toLowerCase() ?? '';
    const authIntentRaw = searchParams.get('intent');
    const authIntent =
      authIntentRaw === 'login' || authIntentRaw === 'get-started' ? authIntentRaw : null;
    const callbackSource = resolveCallbackSource(searchParams.get('source'));
    const fallbackAuthPath = requestedOrgSlug
      ? `/${requestedOrgSlug}/login`
      : '/get-started';

    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash,
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
        const body = (await response.json().catch(() => null)) as {
          onboarding?: {
            requiresOrgSetup?: boolean;
            requiresRoleSelection: boolean;
            destination: string | null;
          };
        } | null;
        return body?.onboarding ?? null;
      } catch (error) {
        reportWebObservedError({
          error,
          source: 'web.auth.callback.activate_account',
          message: 'Failed to activate account after auth callback',
          context: {
            requestedOrgSlug,
            authIntent,
          },
        });
        return null;
      }
    };

    const applyOnboardingState = async (
      onboarding: {
        requiresOrgSetup?: boolean;
        requiresRoleSelection: boolean;
        destination: string | null;
      } | null,
    ) => {
      if (onboarding?.requiresOrgSetup) {
        router.replace(
          onboarding.destination ??
            (requestedOrgSlug ? `/${requestedOrgSlug}/get-started` : fallbackAuthPath),
        );
        return;
      }
      if (onboarding?.requiresRoleSelection) {
        if (
          shouldShowRoleOnboardingDialog({
            authIntent,
            callbackSource,
            requiresRoleSelection: onboarding.requiresRoleSelection,
          })
        ) {
          setLoadingMessage('Complete setup to continue…');
          setRoleOnboardingState({
            orgSlug: requestedOrgSlug || null,
            fallbackDestination: onboarding.destination ?? fallbackAuthPath,
            intent: authIntent,
          });
          return;
        }
        router.replace(onboarding.destination ?? fallbackAuthPath);
        return;
      }
      router.replace(onboarding?.destination ?? fallbackAuthPath);
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
          const onboarding = await activateAccount();
          await applyOnboardingState(onboarding);
          return;
        }

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          const onboarding = await activateAccount();
          await applyOnboardingState(onboarding);
          return;
        }

        if (token) {
          await supabase.auth.verifyOtp({
            token_hash: token,
            type,
          });
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
          router.replace(fallbackAuthPath);
          return;
        }

        const onboarding = await activateAccount();
        await applyOnboardingState(onboarding);
      } catch (error) {
        reportWebObservedError({
          error,
          source: 'web.auth.callback.finish',
          message: 'Failed to complete auth callback',
          context: {
            requestedOrgSlug,
            authIntent,
            callbackSource,
          },
        });
        setPageError('Unable to complete login. Please try again.');
      }
    };

    const callbackRunKey = `auth-callback:${window.location.search}:${window.location.hash}`;
    if (shouldSkipCallbackRun(window.sessionStorage, callbackRunKey)) {
      return;
    }

    void finish();
  }, [router, supabase]);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{pageError ?? loadingMessage}</p>
      {roleOnboardingState ? (
        <RoleOnboardingModal
          open
          onSubmit={async ({ role, inviteCode }) => {
            try {
              const search = new URLSearchParams();
              if (roleOnboardingState.orgSlug) {
                search.set('org', roleOnboardingState.orgSlug);
              }
              const endpoint =
                role === 'student'
                  ? `/api/onboarding/student${search.toString() ? `?${search.toString()}` : ''}`
                  : `/api/onboarding/role${search.toString() ? `?${search.toString()}` : ''}`;
              const body = role === 'student' ? { inviteCode } : { role };

              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body),
              });
              const payload = (await response.json().catch(() => null)) as {
                success?: boolean;
                message?: string;
                onboarding?: { destination?: string | null };
              } | null;

              if (!response.ok || !payload?.success) {
                return {
                  success: false,
                  message: payload?.message ?? 'Unable to complete onboarding.',
                };
              }

              const nextDestination =
                payload.onboarding?.destination ??
                roleOnboardingState.fallbackDestination;
              router.replace(nextDestination);
              return { success: true };
            } catch (error) {
              reportWebObservedError({
                error,
                source: 'web.auth.callback.role_onboarding',
                message: 'Failed to complete role onboarding',
                context: {
                  role,
                  orgSlug: roleOnboardingState.orgSlug,
                },
              });
              return {
                success: false,
                message: 'Unable to complete onboarding. Please try again.',
              };
            }
          }}
        />
      ) : null}
    </div>
  );
}
