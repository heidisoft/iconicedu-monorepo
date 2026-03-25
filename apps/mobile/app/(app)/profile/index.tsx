import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CircleUserRound, HelpCircle, Lock, Palette } from 'lucide-react-native';
import { useAuth } from '@/providers/auth-provider';
import { AppSupportFooter } from '@/components/support/app-support-footer';
import { createHeaderSurface } from '@/lib/header-surface';

const C = {
  bg: '#ffffff',
  bg2: '#f8fafc',
  dark: '#0f172a',
  gray: '#64748b',
  grayLight: '#94a3b8',
  border: '#e2e8f0',
  teal: '#2dd4a8',
  tealFg: '#042f2e',
  red: '#ef4444',
  redLight: '#fff1f2',
};

const settingsItems = [
  { label: 'Edit Profile', icon: CircleUserRound },
  { label: 'Notifications', icon: Bell },
  { label: 'Privacy & Security', icon: Lock },
  { label: 'Appearance', icon: Palette },
  { label: 'Help & Support', icon: HelpCircle },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const displayName = user?.email?.split('@')[0] ?? 'User';
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  return (
    <SafeAreaView style={s.safe}>
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
                style={({ pressed }) => [s.row, pressed && { backgroundColor: C.bg2 }]}
              >
                <item.icon size={18} color={C.gray} />
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

        <Text style={s.version}>IconicEdu Mobile v0.1.0</Text>
        <AppSupportFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  nav: {
    ...createHeaderSurface(C.bg, C.border),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBack: { paddingHorizontal: 4 },
  navBackTxt: { fontSize: 15, color: C.teal, fontWeight: '600' },
  navTitle: { fontSize: 17, fontWeight: '700', color: C.dark },

  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, gap: 20 },

  avatarSection: { alignItems: 'center', gap: 8, paddingBottom: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: C.tealFg, fontWeight: '800', fontSize: 32 },
  displayName: { fontSize: 22, fontWeight: '800', color: C.dark, letterSpacing: -0.3 },
  email: { fontSize: 14, color: C.gray },

  card: {
    backgroundColor: C.bg2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: C.grayLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  rowLabel: { flex: 1, fontSize: 15, color: C.dark, fontWeight: '500' },
  rowChevron: { fontSize: 20, color: C.grayLight },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 56 },

  signOut: {
    backgroundColor: C.redLight,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  signOutTxt: { color: C.red, fontWeight: '700', fontSize: 16 },
  version: { textAlign: 'center', fontSize: 12, color: C.grayLight },
});
