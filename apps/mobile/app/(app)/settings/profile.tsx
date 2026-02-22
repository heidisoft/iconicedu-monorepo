import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function UserIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M4 20C4 17.79 7.58 16 12 16C16.42 16 20 17.79 20 20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IdCardIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M20 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V6C22 4.89543 21.1046 4 20 4Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9} cy={11} r={3} stroke={color} strokeWidth={1.8} />
      <Path d="M14 10H18M14 14H16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

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
    nav:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    navBack:      { padding: 8, borderRadius: 8 },
    navTitle:     { flex: 1, fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center', marginRight: 40 },
    scroll:       { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6 },
    card:         { borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, overflow: 'hidden' },
    divider:      { height: 1, backgroundColor: C.border, marginLeft: 60 },
    valueText:    { fontSize: 13, color: C.textMuted, maxWidth: 160, textAlign: 'right' },
    emptyValue:   { fontSize: 13, color: C.textFaint, fontStyle: 'italic' },
    avatarSection:{ alignItems: 'center', paddingVertical: 24, gap: 10 },
    avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:    { color: C.tealFg, fontWeight: '800', fontSize: 32 },
    avatarName:   { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
    avatarSub:    { fontSize: 13, color: C.teal, fontWeight: '600' },
  });
}

function Val({ value, s }: { value?: string | null; s: ReturnType<typeof makeStyles> }) {
  if (!value) return <Text style={s.emptyValue}>Not set</Text>;
  return <Text style={s.valueText} numberOfLines={2}>{value}</Text>;
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
  const kind = prof?.kind as string | undefined;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar section */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{initial}</Text>
          </View>
          <Text style={s.avatarName}>{displayName}</Text>
          {!!kind && (
            <Text style={s.avatarSub}>{ROLE_LABELS[kind] ?? kind}</Text>
          )}
        </View>

        {/* Identity */}
        <Text style={s.sectionLabel}>Identity</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<UserIcon color={colors.textMuted} />}
            label="Display Name"
            labelColor={colors.text}
            hideChevron
            trailing={<Val value={prof?.display_name as string} s={s} />}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<UserIcon color={colors.textMuted} />}
            label="First Name"
            labelColor={colors.text}
            hideChevron
            trailing={<Val value={prof?.first_name as string} s={s} />}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<UserIcon color={colors.textMuted} />}
            label="Last Name"
            labelColor={colors.text}
            hideChevron
            trailing={<Val value={prof?.last_name as string} s={s} />}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<IdCardIcon color={colors.textMuted} />}
            label="Role"
            labelColor={colors.text}
            hideChevron
            trailing={<Val value={ROLE_LABELS[kind ?? ''] ?? kind} s={s} />}
          />
        </View>

        {/* Bio */}
        {!!(prof?.bio) && (
          <>
            <Text style={s.sectionLabel}>About</Text>
            <View style={s.card}>
              <SettingsRow
                icon={<IdCardIcon color={colors.textMuted} />}
                label="Bio"
                labelColor={colors.text}
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
