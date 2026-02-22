import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import type { AppColors } from '@/lib/theme';

// ─── Icons ────────────────────────────────────────────────────────────────────

function UserIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M4 20C4 17.79 7.58 16 12 16C16.42 16 20 17.79 20 20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function MailIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 6L12 13L2 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function AppearanceIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3V4M12 20V21M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M3 12H4M20 12H21M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function MapPinIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8C18 6.4 17.37 4.87 16.24 3.76C15.13 2.63 13.6 2 12 2C10.4 2 8.87 2.63 7.76 3.76C6.63 4.87 6 6.4 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M13.73 21C13.55 21.3 13.3 21.55 13 21.72C12.7 21.89 12.35 21.97 12 21.97C11.65 21.97 11.3 21.89 11 21.72C10.7 21.55 10.45 21.3 10.27 21" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function UsersIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9} cy={7} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ShieldIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function LogoutIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5C4.47 21 3.96 20.79 3.59 20.41C3.21 20.04 3 19.53 3 19V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 17L21 12L16 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 12H9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

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
            icon={<UserIcon color={colors.textMuted} />}
            label="Profile"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/profile' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<MapPinIcon color={colors.textMuted} />}
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
            icon={<MailIcon color={colors.textMuted} />}
            label="Contact & Security"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/account-info' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<AppearanceIcon color={colors.textMuted} />}
            label="Preferences"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/preferences' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<BellIcon color={colors.textMuted} />}
            label="Notifications"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => router.push('/(app)/settings/notifications' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<ShieldIcon color={colors.textMuted} />}
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
                icon={<UsersIcon color={colors.textMuted} />}
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
            icon={<LogoutIcon color={colors.red} />}
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
