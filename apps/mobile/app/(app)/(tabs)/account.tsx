import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
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
  ArrowRightLeft,
  Check,
} from 'lucide-react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { BottomSheet, Card, SettingsRow } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { useTheme } from '@/providers/theme-provider';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import type { AppColors } from '@/lib/theme';
import { createHeaderSurface } from '@/lib/header-surface';
import { ProfileSkeleton } from '@/components/skeletons';
import {
  AVATAR_SIZE,
  COMPONENT_HEIGHT,
  FONT_SIZE,
  ICON_SIZE,
  LINE_HEIGHT,
  RADIUS,
  SPACING,
  typography,
} from '@/lib/typography';

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

const FAMILY_SWITCH_HANDLE_HEIGHT = AVATAR_SIZE.xs + SPACING[1];
const FAMILY_SWITCH_HEADER_HEIGHT = COMPONENT_HEIGHT.header + SPACING[5];
const FAMILY_SWITCH_CARD_PADDING = SPACING[8] + SPACING[1];
const FAMILY_SWITCH_ROW_HEIGHT = COMPONENT_HEIGHT.rowComfortable - SPACING[1] / 2;
const FAMILY_SWITCH_ROW_GAP = SPACING[3];
const FAMILY_SWITCH_BOTTOM_PADDING = SPACING[5];

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
  }
  return trimmed[0]?.toUpperCase() ?? 'U';
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    header: {
      ...createHeaderSurface(C.pageBg, C.border),
      paddingHorizontal: SPACING[5],
      paddingTop: SPACING[5],
      paddingBottom: SPACING[3],
    },
    pageTitle: {
      fontSize: FONT_SIZE['3xl'],
      lineHeight: LINE_HEIGHT['3xl'],
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.5,
    },
    scroll: {
      paddingHorizontal: SPACING[4],
      paddingTop: SPACING[4],
      paddingBottom: SPACING[12],
      gap: SPACING[5],
    },

    // Profile card
    profileCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      overflow: 'hidden',
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING[4],
      padding: SPACING[5],
    },
    avatarWrap: {
      width: AVATAR_SIZE.xl,
      height: AVATAR_SIZE.xl,
      borderRadius: AVATAR_SIZE.xl / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#ffffff', fontWeight: '800', fontSize: FONT_SIZE['2xl'] },
    profileInfo: { flex: 1, gap: SPACING[1] },
    profileName: {
      fontSize: FONT_SIZE.xl,
      lineHeight: LINE_HEIGHT.xl,
      fontWeight: '700',
      color: C.text,
    },
    profileEmail: { ...typography.meta, color: C.textMuted },
    profileKind: {
      fontSize: FONT_SIZE.sm,
      color: C.teal,
      fontWeight: '600',
      marginTop: SPACING[1] / 2,
    },

    // Section
    sectionLabel: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: SPACING[1],
      marginBottom: -SPACING[2],
    },
    card: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      overflow: 'hidden',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.border,
      marginLeft: AVATAR_SIZE.xl + SPACING[1],
    },
    rowTrailingText: {
      fontSize: FONT_SIZE.base,
      fontWeight: '600',
      color: C.textMuted,
      maxWidth: COMPONENT_HEIGHT.rowComfortable * 2 + SPACING[8],
    },
    familySwitchSheetContent: {
      paddingBottom: FAMILY_SWITCH_BOTTOM_PADDING,
    },
    familySwitchCard: {
      padding: SPACING[5],
      gap: SPACING[3],
    },
    familySwitchHeader: {
      gap: SPACING[1],
    },
    familySwitchTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: '800',
      color: C.text,
    },
    familySwitchSubtitle: {
      fontSize: FONT_SIZE.base,
      color: C.textMuted,
      lineHeight: LINE_HEIGHT.base,
    },
    familySwitchList: {
      gap: SPACING[3],
    },
    familySwitchAvatar: {
      width: AVATAR_SIZE.md,
      height: AVATAR_SIZE.md,
      borderRadius: AVATAR_SIZE.md / 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    familySwitchAvatarImage: { width: AVATAR_SIZE.md, height: AVATAR_SIZE.md },
    familySwitchAvatarText: {
      color: '#ffffff',
      fontSize: FONT_SIZE.base,
      fontWeight: '800',
    },
    switchOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING[3],
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bg,
      paddingHorizontal: SPACING[4],
      paddingVertical: SPACING[3],
    },
    switchOptionActive: {
      borderColor: C.teal,
      backgroundColor: C.tealBg,
    },
    switchOptionText: {
      flex: 1,
      minWidth: 0,
      gap: SPACING[1] / 2,
    },
    switchOptionLabel: {
      fontSize: FONT_SIZE.base,
      fontWeight: '700',
      color: C.text,
    },
    switchOptionSubtext: {
      fontSize: FONT_SIZE.sm,
      color: C.textMuted,
    },
    version: {
      textAlign: 'center',
      fontSize: FONT_SIZE.sm,
      color: C.textFaint,
      marginTop: SPACING[1],
    },
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { familySwitchOptions, switchFamilyView, isViewingAsChild } = useFamilyView();
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
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
  const [familySwitchOpen, setFamilySwitchOpen] = useState(false);
  const [switchingProfileId, setSwitchingProfileId] = useState<string | null>(null);
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
  const activeFamilySwitchOption =
    familySwitchOptions.find((option) => option.isActive) ?? null;
  const canSwitchFamilyView = familySwitchOptions.length > 1;
  const handleFamilySwitch = useCallback(
    async (childProfileId: string | null) => {
      const nextId = childProfileId ?? '__parent__';
      setSwitchingProfileId(nextId);
      try {
        await switchFamilyView(childProfileId);
        await Promise.all([refetchAccount(), refetchProfile()]);
        setFamilySwitchOpen(false);
      } catch (error) {
        Alert.alert(
          'Unable to switch profile',
          error instanceof Error ? error.message : 'Please try again.',
        );
      } finally {
        setSwitchingProfileId(null);
      }
    },
    [refetchAccount, refetchProfile, switchFamilyView],
  );

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
  const familySwitchRowsHeight =
    familySwitchOptions.length * FAMILY_SWITCH_ROW_HEIGHT +
    Math.max(familySwitchOptions.length - 1, 0) * FAMILY_SWITCH_ROW_GAP;
  const familySwitchSheetHeight = Math.min(
    FAMILY_SWITCH_HANDLE_HEIGHT +
      FAMILY_SWITCH_HEADER_HEIGHT +
      FAMILY_SWITCH_CARD_PADDING +
      familySwitchRowsHeight +
      FAMILY_SWITCH_BOTTOM_PADDING,
    windowHeight * 0.78,
  );

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
        {canSwitchFamilyView ? (
          <View style={s.card}>
            <SettingsRow
              icon={<ArrowRightLeft size={ICON_SIZE.md} color={colors.textMuted} />}
              label={
                isViewingAsChild ? 'Switch child account' : 'Switch to child account'
              }
              trailing={
                activeFamilySwitchOption ? (
                  <Text style={s.rowTrailingText} numberOfLines={1}>
                    {activeFamilySwitchOption.displayName?.trim() ||
                      activeFamilySwitchOption.label}
                  </Text>
                ) : undefined
              }
              onPress={() => setFamilySwitchOpen(true)}
            />
          </View>
        ) : null}

        {/* Personal */}
        <Text style={s.sectionLabel}>Personal</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<User size={ICON_SIZE.md} color={colors.textMuted} />}
            label="Profile"
            onPress={() => router.push('/(app)/settings/profile' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<MapPin size={ICON_SIZE.md} color={colors.textMuted} />}
            label="Location"
            onPress={() => router.push('/(app)/settings/location' as never)}
          />
        </View>

        {/* Account */}
        <Text style={s.sectionLabel}>Account</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<Mail size={ICON_SIZE.md} color={colors.textMuted} />}
            label="Contact & Security"
            onPress={() => router.push('/(app)/settings/account-info' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<Sun size={ICON_SIZE.md} color={colors.textMuted} />}
            label="Preferences"
            onPress={() => router.push('/(app)/settings/preferences' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<Bell size={ICON_SIZE.md} color={colors.textMuted} />}
            label="Notifications"
            onPress={() => router.push('/(app)/settings/notifications' as never)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<Shield size={ICON_SIZE.md} color={colors.textMuted} />}
            label="Privacy & Data"
            onPress={() => {}}
          />
        </View>

        {/* Family — guardian only */}
        {isGuardian && (
          <>
            <Text style={s.sectionLabel}>Family</Text>
            <View style={s.card}>
              <SettingsRow
                icon={<Users size={ICON_SIZE.md} color={colors.textMuted} />}
                label="Family"
                onPress={() => router.push('/(app)/settings/family' as never)}
              />
            </View>
          </>
        )}

        {/* Sign out */}
        <View style={s.card}>
          <SettingsRow
            icon={<LogOut size={ICON_SIZE.md} color={colors.red} />}
            label="Sign out"
            onPress={handleSignOut}
            hideChevron
            labelColor={colors.red}
          />
        </View>
        <Text style={s.version}>
          {Constants.expoConfig?.name ?? 'ICONIC Academy'} v
          {Constants.expoConfig?.version ?? '0.1.0'}
        </Text>
      </ScrollView>
      <BottomSheet
        visible={familySwitchOpen}
        onClose={() => setFamilySwitchOpen(false)}
        partialHeight={familySwitchSheetHeight}
        sheetStyle={{ backgroundColor: colors.pageBg }}
      >
        <View style={s.familySwitchSheetContent}>
          <Card style={s.familySwitchCard}>
            <View style={s.familySwitchHeader}>
              <Text style={s.familySwitchTitle}>View as</Text>
              <Text style={s.familySwitchSubtitle}>
                Switch between your parent view and linked child accounts.
              </Text>
            </View>
            <View style={s.familySwitchList}>
              {familySwitchOptions.map((option) => {
                const optionTitle = option.displayName?.trim() || option.label;
                const optionSubtitle = option.isParentOption ? 'Parent' : 'Child';
                const isSwitching =
                  switchingProfileId ===
                  (option.isParentOption ? '__parent__' : option.profileId);
                const optionSeed = option.avatarSeed ?? option.profileId;
                const { bg: optionAvatarBg, fg: optionAvatarFg } = resolveAvatarColor(
                  option.themeKey ?? null,
                  optionSeed,
                );

                return (
                  <TouchableOpacity
                    key={option.profileId}
                    style={[
                      s.switchOption,
                      option.isActive ? s.switchOptionActive : null,
                    ]}
                    disabled={option.isActive || Boolean(switchingProfileId)}
                    onPress={() =>
                      void handleFamilySwitch(
                        option.isParentOption ? null : option.profileId,
                      )
                    }
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        s.familySwitchAvatar,
                        {
                          backgroundColor: option.avatarUrl
                            ? 'transparent'
                            : optionAvatarBg,
                        },
                      ]}
                    >
                      {option.avatarUrl ? (
                        <Image
                          source={{ uri: option.avatarUrl }}
                          style={s.familySwitchAvatarImage}
                        />
                      ) : (
                        <Text
                          style={[s.familySwitchAvatarText, { color: optionAvatarFg }]}
                        >
                          {getInitials(optionTitle)}
                        </Text>
                      )}
                    </View>
                    <View style={s.switchOptionText}>
                      <Text numberOfLines={1} style={s.switchOptionLabel}>
                        {optionTitle}
                      </Text>
                      <Text numberOfLines={1} style={s.switchOptionSubtext}>
                        {isSwitching ? 'Switching...' : optionSubtitle}
                      </Text>
                    </View>
                    {option.isActive ? (
                      <Check size={ICON_SIZE.md} color={colors.teal} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
