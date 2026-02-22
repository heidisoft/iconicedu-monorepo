import '../global.css';
import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { AppProviders } from '@/providers/app-providers';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { fetchOnboardingStatus } from '@/lib/api/queries';

function SpinnerScreen() {
  const { colors, isDark: _d } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.teal} size="large" />
    </View>
  );
}

function NotAllowedScreen({ onSignOut }: { onSignOut: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Text style={[styles.icon]}>🚫</Text>
      <Text style={[styles.title, { color: colors.text }]}>Access not allowed</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        This app is only available for students, parents, and educators.{'\n'}
        Admin and staff accounts must use the web dashboard.
      </Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.teal }]}
        onPress={onSignOut}
      >
        <Text style={[styles.btnTxt, { color: colors.tealFg }]}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  icon:   { fontSize: 48 },
  title:  { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body:   { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  btn:    { marginTop: 8, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  btnTxt: { fontSize: 16, fontWeight: '700' },
});

// StatusBar must be inside AppProviders so it can access ThemeContext
function RootContent() {
  const { isDark } = useTheme();
  const { session, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const { data: onboarding, isLoading: onboardingLoading, isError: onboardingError } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
    enabled: !!session,
    staleTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (loading || !session || onboardingLoading || onboardingError) return;
    if (!onboarding) return;
    // Role not allowed — sign out immediately
    if (!onboarding.isRoleAllowed) {
      signOut();
      return;
    }
    // Onboarding incomplete — redirect to wizard from any screen
    if (!onboarding.isComplete && pathname !== '/profile-setup') {
      router.replace('/(auth)/profile-setup');
    }
  }, [session, loading, onboarding, onboardingLoading, onboardingError, pathname, router, signOut]);

  // Show a blocking screen before sign-out resolves for unauthorized roles
  if (session && !onboardingLoading && !onboardingError && onboarding && !onboarding.isRoleAllowed) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <NotAllowedScreen onSignOut={signOut} />
      </>
    );
  }

  // Show spinner while checking role/onboarding on first load
  if (session && onboardingLoading) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SpinnerScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootContent />
    </AppProviders>
  );
}
