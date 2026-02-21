'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { trackAuthTelemetry } from '@iconicedu/web/lib/telemetry/auth-events';
import {
  RoleOnboardingModal,
  type RoleOnboardingSubmitInput,
} from '@iconicedu/web/app/(auth)/auth/callback/role-onboarding-modal';

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
  const [showRoleModal, setShowRoleModal] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState('Logging you in…');
  const [pageError, setPageError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    const type = resolveOtpType(searchParams.get('type'));
    const isEducatorFlow = searchParams.get('educator') === '1';

    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash,
    );
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    const activateAccount = async () => {
      try {
        const response = await fetch('/api/accounts/activate', {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (!response.ok) return null;
        const body = (await response.json().catch(() => null)) as
          | {
              onboarding?: {
                requiresRoleSelection: boolean;
                destination: '/d' | '/login/pending-access' | null;
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
      requiresRoleSelection: boolean;
      destination: '/d' | '/login/pending-access' | null;
    } | null) => {
      if (onboarding?.requiresRoleSelection) {
        setLoadingMessage('Complete onboarding to continue');
        setShowRoleModal(true);
        return;
      }
      router.replace(onboarding?.destination ?? '/d');
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

  const handleRoleSubmit = async (
    input: RoleOnboardingSubmitInput,
  ): Promise<{ success: boolean; message?: string }> => {
    await trackAuthTelemetry('onboarding_role_selected', { role: input.role });
    if (input.role === 'student') {
      const response = await fetch('/api/onboarding/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ inviteCode: input.inviteCode }),
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        await trackAuthTelemetry('onboarding_invitecode_submitted', {
          success: false,
        });
        return {
          success: false,
          message: errorBody?.message ?? 'Invalid invite code.',
        };
      }
      await trackAuthTelemetry('onboarding_invitecode_submitted', { success: true });
      router.replace('/d');
      return { success: true };
    }

    const response = await fetch('/api/onboarding/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        role: input.role,
        staffAccessCode: input.staffAccessCode,
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          message?: string;
          onboarding?: { destination?: '/d' | '/login/pending-access' | null };
        }
      | null;

    if (!response.ok || !body?.success) {
      return { success: false, message: body?.message ?? 'Unable to complete role setup.' };
    }

    const destination = body.onboarding?.destination ?? '/d';
    router.replace(destination);
    return { success: true };
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{pageError ?? loadingMessage}</p>
      <RoleOnboardingModal open={showRoleModal} onSubmit={handleRoleSubmit} />
    </div>
  );
}
