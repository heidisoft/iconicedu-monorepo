import '../global.css';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/app-providers';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';

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

// StatusBar must be inside AppProviders to access ThemeContext.
function RootContent() {
  const { isDark } = useTheme();
  const { loading } = useAuth();

  // Block only while auth reads the session from SecureStore (local, <100 ms).
  // All routing logic lives in the group layouts — no onboarding checks here.
  if (loading) {
    return <SpinnerScreen />;
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
