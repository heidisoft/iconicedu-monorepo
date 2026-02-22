import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { SectionCard, SettingsRow } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors, ThemeMode } from '@/lib/theme';

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: C.pageBg },
    scroll:       { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 14 },
    pageTitle:    { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, textAlign: 'center', marginBottom: 2 },
    card:         { borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
    profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
    avatarWrap:   { width: 56, height: 56, borderRadius: 28, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:    { color: C.tealFg, fontWeight: '800', fontSize: 22 },
    profileInfo:  { flex: 1, gap: 3 },
    profileName:  { fontSize: 17, fontWeight: '700', color: C.text },
    profileEmail: { fontSize: 13, color: C.textMuted },
    divider:      { height: 1, backgroundColor: C.border, marginLeft: 60 },
    version:      { textAlign: 'center', fontSize: 12, color: C.textFaint, marginTop: 4 },
    // Appearance modal
    overlay:      { flex: 1, backgroundColor: C.modalOverlay, justifyContent: 'flex-end' },
    sheet:        { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40 },
    sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
    sheetTitle:   { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 16 },
    modeRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, gap: 14 },
    modeLabel:    { flex: 1, fontSize: 16, color: C.text, fontWeight: '500' },
    modeSub:      { fontSize: 13, color: C.textMuted },
  });
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
function UserIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M4 20C4 17.79 7.58 16 12 16C16.42 16 20 17.79 20 20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function GearIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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
function AppearanceIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3V4M12 20V21M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M3 12H4M20 12H21M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function HelpIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} />
      <Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 17h.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
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
function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17L4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const MODE_OPTIONS: { value: ThemeMode; label: string; sub: string }[] = [
  { value: 'system', label: 'System',  sub: 'Follow device setting' },
  { value: 'light',  label: 'Light',   sub: 'Always light' },
  { value: 'dark',   label: 'Dark',    sub: 'Always dark' },
];

// ── Screen ────────────────────────────────────────────────────────────────────
export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [showAppearance, setShowAppearance] = React.useState(false);
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const displayName = user?.email?.split('@')[0] ?? 'User';
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  const modeLabel = MODE_OPTIONS.find((o) => o.value === mode)?.label ?? 'System';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Profile</Text>

        {/* Profile card */}
        <SectionCard variant="white" padding={0} style={[s.card, { backgroundColor: colors.card }]}>
          <View style={s.profileRow}>
            <View style={s.avatarWrap}>
              <Text style={s.avatarTxt}>{initial}</Text>
            </View>
            <View style={s.profileInfo}>
              <Text style={s.profileName}>{displayName}</Text>
              <Text style={s.profileEmail}>{user?.email ?? ''}</Text>
            </View>
          </View>
        </SectionCard>

        {/* Settings list */}
        <SectionCard variant="white" padding={0} style={[s.card, { backgroundColor: colors.card }]}>
          <SettingsRow icon={<UserIcon color={colors.textMuted} />}       label="Personal"         labelColor={colors.text} chevronColor={colors.textFaint} onPress={() => {}} />
          <View style={s.divider} />
          <SettingsRow icon={<GearIcon color={colors.textMuted} />}       label="General"          labelColor={colors.text} chevronColor={colors.textFaint} onPress={() => {}} />
          <View style={s.divider} />
          <SettingsRow
            icon={<BellIcon color={colors.textMuted} />}
            label="Push Notifications"
            labelColor={colors.text}
            hideChevron
            trailing={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.switchTrackOff, true: colors.teal }}
                thumbColor="#ffffff"
              />
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<AppearanceIcon color={colors.textMuted} />}
            label="Appearance"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => setShowAppearance(true)}
            trailing={
              <Text style={{ fontSize: 13, color: colors.textMuted, marginRight: 4 }}>{modeLabel}</Text>
            }
          />
          <View style={s.divider} />
          <SettingsRow icon={<HelpIcon color={colors.textMuted} />}       label="Help"             labelColor={colors.text} chevronColor={colors.textFaint} onPress={() => {}} />
          <View style={s.divider} />
          <SettingsRow icon={<ShieldIcon color={colors.textMuted} />}     label="Privacy & Data"   labelColor={colors.text} chevronColor={colors.textFaint} onPress={() => {}} />
        </SectionCard>

        {/* Sign out */}
        <SectionCard variant="white" padding={0} style={[s.card, { backgroundColor: colors.card }]}>
          <SettingsRow
            icon={<LogoutIcon color={colors.red} />}
            label="Sign out"
            onPress={handleSignOut}
            hideChevron
            labelColor={colors.red}
          />
        </SectionCard>

        <Text style={s.version}>IconicEdu v0.1.0</Text>
      </ScrollView>

      {/* Appearance bottom sheet */}
      <Modal
        visible={showAppearance}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAppearance(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowAppearance(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Appearance</Text>
              {MODE_OPTIONS.map((opt, i) => (
                <React.Fragment key={opt.value}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 24 }} />}
                  <TouchableOpacity
                    style={s.modeRow}
                    onPress={() => { setMode(opt.value); setShowAppearance(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={s.modeLabel}>{opt.label}</Text>
                      <Text style={s.modeSub}>{opt.sub}</Text>
                    </View>
                    {mode === opt.value && <CheckIcon color={colors.teal} />}
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
