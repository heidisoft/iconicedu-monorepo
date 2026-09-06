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
        <View style={{ width: 64 }} />
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
                <item.icon size={18} color={colors.textMuted} />
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
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    navBack: { paddingHorizontal: 4 },
    navBackTxt: { fontSize: 16, color: C.teal, fontWeight: '600' },
    navTitle: { fontSize: 19, fontWeight: '700', color: C.text },
    content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, gap: 20 },
    avatarSection: { alignItems: 'center', gap: 8, paddingBottom: 8 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: C.action,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    avatarTxt: { color: C.actionForeground, fontWeight: '800', fontSize: 34 },
    displayName: {
      fontSize: 24,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0,
    },
    email: { fontSize: 15, color: C.textMuted },
    card: {
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    cardHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowLabel: { flex: 1, fontSize: 16, color: C.text, fontWeight: '500' },
    rowChevron: { fontSize: 20, color: C.textFaint },
    divider: { height: 1, backgroundColor: C.border, marginLeft: 56 },
    signOut: {
      backgroundColor: C.red + '10',
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.red + '24',
    },
    signOutTxt: { color: C.red, fontWeight: '700', fontSize: 17 },
    version: { textAlign: 'center', fontSize: 13, color: C.textFaint },
  });
}
