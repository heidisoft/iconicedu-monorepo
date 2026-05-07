import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CircleUserRound, HelpCircle, Lock, Palette } from 'lucide-react-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { AppSupportFooter } from '@/components/support/app-support-footer';
import { createHeaderSurface } from '@/lib/header-surface';
import type { AppColors } from '@/lib/theme';
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

const settingsItems = [
  { label: 'Edit Profile', icon: CircleUserRound },
  { label: 'Notifications', icon: Bell },
  { label: 'Privacy & Security', icon: Lock },
  { label: 'Appearance', icon: Palette },
  { label: 'Help & Support', icon: HelpCircle },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const displayName = user?.email?.split('@')[0] ?? 'User';
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Nav bar */}
      <View style={s.nav}>
        <TouchableOpacity onPress={() => router.back()} style={s.navBack}>
          <Text style={s.navBackTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Profile</Text>
        <View style={s.navSpacer} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{initial}</Text>
          </View>
          <Text style={s.displayName}>{displayName}</Text>
          <Text style={s.email}>{user?.email}</Text>
        </View>

        {/* Settings card */}
        <View style={s.card}>
          <Text style={s.cardHeader}>Settings</Text>
          {settingsItems.map((item, i) => (
            <React.Fragment key={item.label}>
              <Pressable
                style={({ pressed }) => [
                  s.row,
                  pressed && { backgroundColor: colors.inputBg },
                ]}
              >
                <item.icon size={ICON_SIZE.md} color={colors.textMuted} />
                <Text style={s.rowLabel}>{item.label}</Text>
                <Text style={s.rowChevron}>›</Text>
              </Pressable>
              {i < settingsItems.length - 1 && <View style={s.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.signOut} onPress={signOut} activeOpacity={0.8}>
          <Text style={s.signOutTxt}>Sign out</Text>
        </TouchableOpacity>

        <Text style={s.version}>
          {Constants.expoConfig?.name ?? 'ICONIC Academy'} v
          {Constants.expoConfig?.version ?? '0.1.0'}
        </Text>
        <AppSupportFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    nav: {
      ...createHeaderSurface(C.pageBg, C.border),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING[4],
      paddingVertical: SPACING[3],
    },
    navBack: { paddingHorizontal: SPACING[1] },
    navBackTxt: { ...typography.body, color: C.teal, fontWeight: '600' },
    navTitle: {
      fontSize: FONT_SIZE.xl,
      lineHeight: LINE_HEIGHT.xl,
      fontWeight: '700',
      color: C.text,
    },
    navSpacer: { width: COMPONENT_HEIGHT.rowComfortable },
    content: {
      paddingHorizontal: SPACING[4],
      paddingTop: SPACING[6],
      paddingBottom: SPACING[10],
      gap: SPACING[5],
    },
    avatarSection: { alignItems: 'center', gap: SPACING[2], paddingBottom: SPACING[2] },
    avatar: {
      width: AVATAR_SIZE['2xl'] + SPACING[2],
      height: AVATAR_SIZE['2xl'] + SPACING[2],
      borderRadius: (AVATAR_SIZE['2xl'] + SPACING[2]) / 2,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    avatarTxt: {
      color: C.tealFg,
      fontWeight: '800',
      fontSize: FONT_SIZE['3xl'] + SPACING[3],
    },
    displayName: {
      fontSize: FONT_SIZE['2xl'],
      lineHeight: LINE_HEIGHT['2xl'],
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.3,
    },
    email: { ...typography.sm, color: C.textMuted },
    card: {
      backgroundColor: C.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    cardHeader: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: SPACING[4],
      paddingTop: SPACING[4],
      paddingBottom: SPACING[2],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING[3],
      paddingHorizontal: SPACING[4],
      paddingVertical: SPACING[4],
    },
    rowLabel: { flex: 1, ...typography.body, color: C.text, fontWeight: '500' },
    rowChevron: { fontSize: FONT_SIZE['2xl'], color: C.textFaint },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.border,
      marginLeft: AVATAR_SIZE.xl,
    },
    signOut: {
      backgroundColor: C.red + '10',
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING[4],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.red + '24',
    },
    signOutTxt: { color: C.red, fontWeight: '700', fontSize: FONT_SIZE.lg },
    version: { textAlign: 'center', fontSize: FONT_SIZE.sm, color: C.textFaint },
  });
}
