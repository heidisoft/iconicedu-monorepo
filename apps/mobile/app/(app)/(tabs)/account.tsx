import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, Sun, MapPin, Bell, Users, Shield, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import type { AppColors } from '@/lib/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  educator: 'Educator',
  guardian: 'Parent / Guardian',
  child:    'Student',
  staff:    'Staff',
  admin:    'Admin',
  owner:    'Owner',
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: C.pageBg },
    header:       { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
    pageTitle:    { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    scroll:       { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 20 },

    // Profile card
    profileCard:  { borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, overflow: 'hidden' },
    profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
    avatarWrap:   { width: 56, height: 56, borderRadius: 28, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:    { color: C.tealFg, fontWeight: '800', fontSize: 22 },
    profileInfo:  { flex: 1, gap: 3 },
    profileName:  { fontSize: 17, fontWeight: '700', color: C.text },
    profileEmail: { fontSize: 13, color: C.textMuted },
    profileKind:  { fontSize: 12, color: C.teal, fontWeight: '600', marginTop: 2 },

    // Section
    sectionLabel: { fontSize: 12, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4, marginBottom: -8 },
    card:         { borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, overflow: 'hidden' },
    divider:      { height: 1, backgroundColor: C.border, marginLeft: 60 },
    version:      { textAlign: 'center', fontSize: 12, color: C.textFaint, marginTop: 4 },
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const router = useRouter();

  const s = useMemo(() => makeStyles(colors), [colors]);

  const acc = account as Record<string, unknown> | undefined;
  const prof = profile as Record<string, unknown> | undefined;

  const displayName =
    (prof?.display_name as string) ??
    (prof?.first_name as string) ??
    user?.email?.split('@')[0] ??
    'User';
  const initial = displayName[0]?.toUpperCase() ?? 'U';
  const profileKind = (prof?.kind as string) ?? (acc?.primary_role as string);
  const isGuardian = profileKind === 'guardian';

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }, [signOut]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.pageTitle}>Account</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.profileRow}>
            <View style={s.avatarWrap}>
              <Text style={s.avatarTxt}>{initial}</Text>
            </View>
            <View style={s.profileInfo}>
              <Text style={s.profileName}>{displayName}</Text>
              <Text style={s.profileEmail}>{user?.email ?? ''}</Text>
              {!!profileKind && (
                <Text style={s.profileKind}>
                  {ROLE_LABELS[profileKind] ?? profileKind}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Personal */}
        <Text style={s.sectionLabel}>Personal</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<User size={20} color={colors.textMuted} />}
            label="Profile"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/profile' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<MapPin size={20} color={colors.textMuted} />}
            label="Location"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/location' as never)}
          />
        </View>

        {/* Account */}
        <Text style={s.sectionLabel}>Account</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<Mail size={20} color={colors.textMuted} />}
            label="Contact & Security"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/account-info' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<Sun size={20} color={colors.textMuted} />}
            label="Preferences"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/preferences' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<Bell size={20} color={colors.textMuted} />}
            label="Notifications"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/notifications' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<Shield size={20} color={colors.textMuted} />}
            label="Privacy & Data"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => {}}
          />
        </View>

        {/* Family — guardian only */}
        {isGuardian && (
          <>
            <Text style={s.sectionLabel}>Family</Text>
            <View style={s.card}>
              <SettingsRow
                icon={<Users size={20} color={colors.textMuted} />}
                label="Family"
                labelColor={colors.text}
                chevronColor={colors.textFaint}
                onPress={() => router.push('/(app)/settings/family' as never)}
              />
            </View>
          </>
        )}

        {/* Sign out */}
        <View style={s.card}>
          <SettingsRow
            icon={<LogOut size={20} color={colors.red} />}
            label="Sign out"
            onPress={handleSignOut}
            hideChevron
            labelColor={colors.red}
          />
        </View>

        <Text style={s.version}>IconicEdu v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
