import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, User, CreditCard } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

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
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    navBack: { padding: 8, borderRadius: 8 },
    navTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginRight: 40,
    },
    scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: 4,
      paddingTop: 14,
      paddingBottom: 6,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      overflow: 'hidden',
    },
    divider: { height: 1, backgroundColor: C.border, marginLeft: 60 },
    valueText: { fontSize: 13, color: C.textMuted, maxWidth: 160, textAlign: 'right' },
    emptyValue: { fontSize: 13, color: C.textFaint, fontStyle: 'italic' },
    avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: C.tealFg, fontWeight: '800', fontSize: 32 },
    avatarName: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
    avatarSub: { fontSize: 13, color: C.teal, fontWeight: '600' },
  });
}

function Val({ value, s }: { value?: string | null; s: ReturnType<typeof makeStyles> }) {
  if (!value) return <Text style={s.emptyValue}>Not set</Text>;
  return (
    <Text style={s.valueText} numberOfLines={2}>
      {value}
    </Text>
  );
}

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { data: profile } = useProfile();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const prof = profile as Record<string, unknown> | undefined;
  const displayName =
    (prof?.display_name as string) ??
    (prof?.first_name as string) ??
    user?.email?.split('@')[0] ??
    'User';
  const initial = displayName[0]?.toUpperCase() ?? 'U';
  const avatarUrl = prof?.avatar_url as string | null | undefined;
  const kind = prof?.kind as string | undefined;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar section */}
        <View style={s.avatarSection}>
          {avatarUrl ? (
            <View style={s.avatar}>
              <Image source={{ uri: avatarUrl }} style={s.avatar} />
            </View>
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{initial}</Text>
            </View>
          )}
          <Text style={s.avatarName}>{displayName}</Text>
          {!!kind && <Text style={s.avatarSub}>{ROLE_LABELS[kind] ?? kind}</Text>}
        </View>

        {/* Identity */}
        <Text style={s.sectionLabel}>Identity</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<User size={20} color={colors.textMuted} />}
            label="Display Name"
            hideChevron
            trailing={<Val value={prof?.display_name as string} s={s} />}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<User size={20} color={colors.textMuted} />}
            label="First Name"
            hideChevron
            trailing={<Val value={prof?.first_name as string} s={s} />}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<User size={20} color={colors.textMuted} />}
            label="Last Name"
            hideChevron
            trailing={<Val value={prof?.last_name as string} s={s} />}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<CreditCard size={20} color={colors.textMuted} />}
            label="Role"
            hideChevron
            trailing={<Val value={ROLE_LABELS[kind ?? ''] ?? kind} s={s} />}
          />
        </View>

        {/* Bio */}
        {!!prof?.bio && (
          <>
            <Text style={s.sectionLabel}>About</Text>
            <View style={s.card}>
              <SettingsRow
                icon={<CreditCard size={20} color={colors.textMuted} />}
                label="Bio"
                hideChevron
                trailing={
                  <Text style={[s.valueText, { maxWidth: 200 }]} numberOfLines={4}>
                    {prof.bio as string}
                  </Text>
                }
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
