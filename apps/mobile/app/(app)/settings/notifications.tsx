import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useNotificationPrefs } from '@/hooks/use-notification-prefs';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
function BellOffIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M13.73 21C13.55 21.3 13.3 21.55 13 21.72C12.7 21.89 12.35 21.97 12 21.97C11.65 21.97 11.3 21.89 11 21.72C10.7 21.55 10.45 21.3 10.27 21M18 8C18 6.4 17.37 4.87 16.24 3.76M6 8C6 5.3 7.93 3.1 10.5 2.5M3 3L21 21M6 6L3 17H21L18 11" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const NOTIF_LABELS: Record<string, string> = {
  'message.posted':    'New Messages',
  'homework.assigned': 'Homework Assigned',
  'homework.submitted':'Homework Submitted',
  'homework.reviewed': 'Homework Reviewed',
  'session.scheduled': 'Session Scheduled',
  'session.completed': 'Session Completed',
  'class.created':     'New Class',
  'member.joined':     'Member Joined',
  'member.invited':    'Invitations',
  'summary.posted':    'AI Summary',
  'notes.posted':      'Notes Posted',
  'file.uploaded':     'File Uploaded',
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
    loading:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyCard:    { padding: 24, alignItems: 'center', gap: 8 },
    emptyIcon:    { fontSize: 32 },
    emptyTitle:   { fontSize: 15, fontWeight: '600', color: C.text },
    emptyDesc:    { fontSize: 13, color: C.textMuted, textAlign: 'center' },
    hint:         { fontSize: 12, color: C.textFaint, paddingHorizontal: 4 },
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: prefs = [], isLoading } = useNotificationPrefs();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // Local muted state — keyed by pref_key; '__push__' = master push toggle
  const [mutedMap, setMutedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if ((prefs as Record<string, unknown>[]).length > 0) {
      const init: Record<string, boolean> = {};
      for (const p of prefs as Record<string, unknown>[]) {
        init[p.pref_key as string] = (p.muted as boolean) ?? false;
      }
      setMutedMap(init);
    }
  }, [prefs]);

  const toggle = useCallback((key: string) => {
    setMutedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
            <ChevronLeftIcon color={colors.text} />
          </TouchableOpacity>
          <Text style={s.navTitle}>Notifications</Text>
        </View>
        <View style={s.loading}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Push master toggle */}
        <Text style={s.sectionLabel}>Push Notifications</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<BellIcon color={colors.textMuted} />}
            label="Allow push notifications"
            labelColor={colors.text}
            hideChevron
            trailing={
              <Switch
                value={mutedMap['__push__'] !== true}
                onValueChange={() => toggle('__push__')}
                trackColor={{ false: colors.switchTrackOff, true: colors.teal }}
                thumbColor="#ffffff"
              />
            }
          />
        </View>

        {/* Per-category preferences */}
        {(prefs as Record<string, unknown>[]).length === 0 ? (
          <>
            <Text style={s.sectionLabel}>Categories</Text>
            <View style={[s.card, s.emptyCard]}>
              <Text style={s.emptyIcon}>🔔</Text>
              <Text style={s.emptyTitle}>No preferences configured</Text>
              <Text style={s.emptyDesc}>
                Notification categories will appear here once they are available for your account.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={s.sectionLabel}>Categories</Text>
            <View style={s.card}>
              {(prefs as Record<string, unknown>[]).map((pref, i) => {
                const key = pref.pref_key as string;
                const label = NOTIF_LABELS[key] ?? key;
                const isMuted = mutedMap[key] ?? (pref.muted as boolean) ?? false;
                const icon = isMuted
                  ? <BellOffIcon color={colors.textFaint} />
                  : <BellIcon color={colors.textMuted} />;
                return (
                  <React.Fragment key={key}>
                    {i > 0 && <View style={s.divider} />}
                    <SettingsRow
                      icon={icon}
                      label={label}
                      labelColor={isMuted ? colors.textFaint : colors.text}
                      hideChevron
                      trailing={
                        <Switch
                          value={!isMuted}
                          onValueChange={() => toggle(key)}
                          trackColor={{ false: colors.switchTrackOff, true: colors.teal }}
                          thumbColor="#ffffff"
                        />
                      }
                    />
                  </React.Fragment>
                );
              })}
            </View>
            <Text style={s.hint}>Changes apply to this device only.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
