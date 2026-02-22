import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { fetchOnboardingStatus } from '@/lib/api/queries';

export default function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

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
        if (!status.isComplete) {
          router.replace('/(auth)/profile-setup');
        }
      })
      .catch(() => {
        // Network error or timeout — let the user access the app.
        // They can complete their profile later from account settings.
      });
  // Re-run only when the authenticated user changes (login/logout).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  if (loading || !session) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.pageBg },
      }}
    />
  );
}
