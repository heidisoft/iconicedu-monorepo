import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { fetchOnboardingStatus } from '@/lib/api/queries';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  // Share the same query key as the root layout — no extra network request
  const { data: onboarding, isLoading: onboardingLoading, isError: onboardingError } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
    enabled: !!session,
    staleTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [session, loading, router]);

  if (loading || !session) return null;

  // Block app screens from rendering until role + onboarding are confirmed.
  // The root layout handles the actual redirect/signout; we just hold here.
  if (onboardingLoading) return null;
  if (!onboardingError && onboarding && !onboarding.isRoleAllowed) return null;
  if (!onboardingError && onboarding && !onboarding.isComplete) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.pageBg },
      }}
    />
  );
}
