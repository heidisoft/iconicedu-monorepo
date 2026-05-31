import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { fetchOnboardingStatus } from '@/lib/api/queries';
import { useNotificationHandler } from '@/hooks/use-notification-handler';
import { usePushRegistration } from '@/hooks/use-push-registration';
import { PushPermissionSheet } from '@/components/notifications/push-permission-sheet';

export default function AppLayout() {
  const { session, loading, setOnboardingCompletionStatus } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { showConsent, onConsentGranted, onConsentDismissed } = usePushRegistration();
  useNotificationHandler();

  // Auth guard: redirect to login if not authenticated.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [session, loading, router]);

  // Non-blocking onboarding guard: check once per user session.
  // Uses the TanStack Query cache — if the OTP or Google sign-in flow already
  // called fetchOnboardingStatus (staleTime 5 min), this resolves from cache
  // instantly with no network request. Only fetches if cache is cold/stale.
  useEffect(() => {
    if (loading || !session) return;

    queryClient
      .fetchQuery({
        queryKey: ['onboarding-status'],
        queryFn: fetchOnboardingStatus,
        staleTime: 5 * 60 * 1000,
      })
      .then((status) => {
        setOnboardingCompletionStatus(status.isComplete);
        if (!status.isComplete) {
          router.replace('/(auth)/profile-setup');
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : '';
        if (message.includes('No account found')) {
          // New user with no account row — send to onboarding to create one.
          router.replace('/(auth)/profile-setup');
          return;
        }
        // Network error or timeout — let the user access the app.
      });
    // Re-run only when the authenticated user changes (login/logout).
  }, [
    loading,
    queryClient,
    router,
    session,
    session?.user.id,
    setOnboardingCompletionStatus,
  ]);

  if (loading || !session) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.pageBg },
        }}
      />
      <PushPermissionSheet
        visible={showConsent}
        onEnable={onConsentGranted}
        onDismiss={onConsentDismissed}
      />
    </>
  );
}
