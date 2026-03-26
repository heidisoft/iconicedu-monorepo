import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Sun,
  MapPin,
  Bell,
  Users,
  Shield,
  LogOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import type { AppColors } from '@/lib/theme';
import { createHeaderSurface } from '@/lib/header-surface';
import { ProfileSkeleton } from '@/components/skeletons';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const THEME_KEY_COLORS: Record<string, { bg: string; fg: string }> = {
  slate: { bg: '#64748b', fg: '#ffffff' },
  gray: { bg: '#6b7280', fg: '#ffffff' },
  zinc: { bg: '#71717a', fg: '#ffffff' },
  neutral: { bg: '#737373', fg: '#ffffff' },
  stone: { bg: '#78716c', fg: '#ffffff' },
  red: { bg: '#ef4444', fg: '#ffffff' },
  orange: { bg: '#f97316', fg: '#ffffff' },
  amber: { bg: '#f59e0b', fg: '#1f2937' },
  yellow: { bg: '#eab308', fg: '#1f2937' },
  lime: { bg: '#84cc16', fg: '#1f2937' },
  green: { bg: '#22c55e', fg: '#ffffff' },
  emerald: { bg: '#10b981', fg: '#ffffff' },
  teal: { bg: '#14b8a6', fg: '#ffffff' },
  cyan: { bg: '#06b6d4', fg: '#ffffff' },
  sky: { bg: '#0ea5e9', fg: '#ffffff' },
  blue: { bg: '#3b82f6', fg: '#ffffff' },
  indigo: { bg: '#6366f1', fg: '#ffffff' },
  violet: { bg: '#8b5cf6', fg: '#ffffff' },
  purple: { bg: '#a855f7', fg: '#ffffff' },
  fuchsia: { bg: '#d946ef', fg: '#ffffff' },
  pink: { bg: '#ec4899', fg: '#ffffff' },
  rose: { bg: '#f43f5e', fg: '#ffffff' },
};

const AVATAR_SEED_COLORS = [
  '#5B8DEF',
  '#E07B54',
  '#6CC070',
  '#A86CC1',
  '#E0A854',
  '#54B8C4',
  '#E06C8A',
];

function resolveAvatarColor(
  themeKey?: string | null,
  seed?: string | null,
): { bg: string; fg: string } {
  if (themeKey && THEME_KEY_COLORS[themeKey]) return THEME_KEY_COLORS[themeKey]!;
  let h = 0;
  const s = seed ?? 'default';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return { bg: AVATAR_SEED_COLORS[h % AVATAR_SEED_COLORS.length]!, fg: '#ffffff' };
}

const ROLE_LABELS: Record<string, string> = {
  educator: 'Educator',
  guardian: 'Parent / Guardian',
  child: 'Student',
  staff: 'Staff',
  admin: 'Admin',
  owner: 'Owner',
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    header: {
      ...createHeaderSurface(C.pageBg, C.border),
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 10,
    },
    pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 20 },

    // Profile card
    profileCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      overflow: 'hidden',
    },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
    avatarWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#ffffff', fontWeight: '800', fontSize: 22 },
    profileInfo: { flex: 1, gap: 3 },
    profileName: { fontSize: 17, fontWeight: '700', color: C.text },
    profileEmail: { fontSize: 13, color: C.textMuted },
    profileKind: { fontSize: 12, color: C.teal, fontWeight: '600', marginTop: 2 },

    // Section
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: 4,
      marginBottom: -8,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      overflow: 'hidden',
    },
    divider: { height: 1, backgroundColor: C.border, marginLeft: 60 },
    version: { textAlign: 'center', fontSize: 12, color: C.textFaint, marginTop: 4 },
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const {
    data: account,
    isPending: accountLoading,
    refetch: refetchAccount,
  } = useAccount();
  const {
    data: profile,
    isPending: profileLoading,
    refetch: refetchProfile,
  } = useProfile();
  const router = useRouter();

  const s = useMemo(() => makeStyles(colors), [colors]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refetchAccount(), refetchProfile()]).finally(() => setRefreshing(false));
  }, [refetchAccount, refetchProfile]);

  const acc = account as Record<string, unknown> | undefined;
  const prof = profile as Record<string, unknown> | undefined;

  const displayName =
    (prof?.display_name as string) ??
    (prof?.first_name as string) ??
    user?.email?.split('@')[0] ??
    'User';
  const initial = displayName[0]?.toUpperCase() ?? 'U';
  const avatarUrl = prof?.avatar_url as string | null | undefined;
  const { bg: avatarBg, fg: avatarFg } = resolveAvatarColor(
    prof?.ui_theme_key as string | null,
    (prof?.avatar_seed as string | null) ?? user?.id ?? user?.email,
  );
  const profileKind = (prof?.kind as string) ?? (acc?.primary_role as string);
  const isGuardian = profileKind === 'guardian';

  if (accountLoading || profileLoading || refreshing) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Text style={s.pageTitle}>Account</Text>
        </View>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.pageTitle}>Account</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
          />
        }
      >
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.profileRow}>
            {avatarUrl ? (
              <View style={s.avatarWrap}>
                <Image source={{ uri: avatarUrl }} style={s.avatarWrap} />
              </View>
            ) : (
              <View style={[s.avatarWrap, { backgroundColor: avatarBg }]}>
                <Text style={[s.avatarTxt, { color: avatarFg }]}>{initial}</Text>
              </View>
            )}
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
