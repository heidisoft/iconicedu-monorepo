import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading || !session) return;
    // segments: ['(auth)', 'login'] | ['(auth)', 'otp'] | ['(auth)', 'profile-setup']
    // profile-setup is valid for logged-in users with incomplete onboarding.
    // login and otp should redirect to the app if the user already has a session.
    const screen = segments[1];
    if (screen !== 'profile-setup') {
      router.replace('/(app)/(tabs)');
    }
  }, [session, loading, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
