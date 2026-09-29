import '../global.css';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders } from '@/providers/app-providers';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { ScreenTracker } from '@/components/analytics/screen-tracker';
import { AppLifecycleTracker } from '@/components/analytics/app-lifecycle-tracker';
import { PresenceTracker } from '@/components/presence/presence-tracker';
import { WhatsNewModal } from '@/components/updates/whats-new-modal';
import { UpdateRequiredBanner } from '@/components/updates/update-required-banner';
import { useAiAssistEligibility } from '@/hooks/use-ai-assist-eligibility';
import { useAppUpdate } from '@/hooks/use-app-update';
import { useMobileAppUpdateRequired } from '@/hooks/use-mobile-app-update-required';
import { useWhatsNewReleaseNotes } from '@/hooks/use-whats-new-release-notes';

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
  const familyView = useFamilyView();
  const whatsNew = useWhatsNewReleaseNotes();
  const appUpdateRequired = useMobileAppUpdateRequired();
  useAppUpdate();

  // Same server-derived truth MessageInput gates its own AI buttons on
  // (org has AI configured + profile kind + PostHog rollout) — see
  // AiAssistService.getEligibility. A release note flagged
  // requiresAiAssistEligibility only shows once this says the profile can
  // actually use at least one of the capabilities it announces.
  const orgId = (familyView.account?.org_id as string | undefined) ?? null;
  const profileId = (familyView.profile?.id as string | undefined) ?? null;
  const aiAssistEligibility = useAiAssistEligibility({ orgId, profileId });
  const isWhatsNewEligible =
    !whatsNew.releaseNotes.requiresAiAssistEligibility ||
    aiAssistEligibility.enableAiRefine ||
    aiAssistEligibility.enableAiSuggestedReplies;

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
      <PresenceTracker />
      <Slot />
      <WhatsNewModal
        visible={whatsNew.shouldShow && isWhatsNewEligible}
        releaseNotes={whatsNew.releaseNotes}
        onDismiss={whatsNew.dismiss}
      />
      <UpdateRequiredBanner
        visible={appUpdateRequired.shouldShow}
        message={appUpdateRequired.message}
        storeUrl={appUpdateRequired.storeUrl}
        onDismiss={appUpdateRequired.dismiss}
      />
      <PortalHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <RootContent />
      </AppProviders>
    </SafeAreaProvider>
  );
}
