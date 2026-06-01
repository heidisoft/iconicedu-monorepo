import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { fetchOnboardingStatus } from '@/lib/api/queries';
import { queryKeys } from '@/lib/api/query-keys';
import { useNotificationHandler } from '@/hooks/use-notification-handler';
import { usePushRegistration } from '@/hooks/use-push-registration';
import { PushPermissionSheet } from '@/components/notifications/push-permission-sheet';

function PushRegistrationGate() {
  const { showConsent, onConsentGranted, onConsentDismissed } = usePushRegistration();

  return (
    <PushPermissionSheet
      visible={showConsent}
      onEnable={onConsentGranted}
      onDismiss={onConsentDismissed}
    />
  );
}

export default function AppLayout() {
  const { session, loading, setOnboardingCompletionStatus } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [onboardingCheckedUserId, setOnboardingCheckedUserId] = useState<string | null>(
    null,
  );

  useNotificationHandler();

  // Auth guard: redirect to login if not authenticated.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [session, loading, router]);

  // Onboarding guard: check once per user session before mounting app screens.
  // Uses a user-scoped TanStack Query cache so a previous signed-in user's
  // completed onboarding state cannot leak into a new signup session.
  useEffect(() => {
    if (loading || !session) {
      setOnboardingCheckedUserId(null);
      return;
    }

    let cancelled = false;
    const userId = session.user.id;

    queryClient
      .fetchQuery({
        queryKey: queryKeys.onboardingStatus(userId),
        queryFn: fetchOnboardingStatus,
        staleTime: 5 * 60 * 1000,
      })
      .then((status) => {
        if (cancelled) return;
        setOnboardingCompletionStatus(status.isComplete);
        if (!status.isComplete) {
          router.replace('/(auth)/profile-setup');
          return;
        }
        setOnboardingCheckedUserId(userId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '';
        if (message.includes('No account found')) {
          // New user with no account row — send to onboarding to create one.
          router.replace('/(auth)/profile-setup');
          return;
        }
        // Network error or timeout — let the user access the app.
        setOnboardingCheckedUserId(userId);
      });

    return () => {
      cancelled = true;
    };
    // Re-run only when the authenticated user changes (login/logout).
  }, [
    loading,
    queryClient,
    router,
    session,
    session?.user.id,
    setOnboardingCompletionStatus,
  ]);

  if (loading || !session || onboardingCheckedUserId !== session.user.id) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.pageBg },
        }}
      />
      <PushRegistrationGate />
    </>
  );
}
