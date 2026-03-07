import '../global.css';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';
import { AppProviders } from '@/providers/app-providers';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { ScreenTracker } from '@/components/analytics/screen-tracker';
import { AppLifecycleTracker } from '@/components/analytics/app-lifecycle-tracker';

function SpinnerScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.teal} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

// StatusBar and navigation bar appearance must be inside AppProviders to access ThemeContext.
function RootContent() {
  const { isDark } = useTheme();
  const { loading } = useAuth();

  if (loading) {
    return <SpinnerScreen />;
  }

  return (
    <>
      {/*
        SystemBars (expo-edge-to-edge) manages BOTH the status bar AND the
        Android gesture navigation bar appearance in one place.
          style="light" → light icons/handles  (use on dark backgrounds)
          style="dark"  → dark icons/handles   (use on light backgrounds)
        The navigation bar background color comes from the React Native content
        rendered behind it (the tab bar's tabBarBackground), not from this component.
      */}
      <SystemBars style={isDark ? 'light' : 'dark'} />
      <ScreenTracker />
      <AppLifecycleTracker />
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
