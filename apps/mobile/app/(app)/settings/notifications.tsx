import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bell, BellOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { NotificationSettingsSkeleton } from '@/components/skeletons';
import { useNotificationPrefs } from '@/hooks/use-notification-prefs';
import { usePushToggle } from '@/hooks/use-push-toggle';
import { useUpdateNotificationPref } from '@/hooks/use-update-notification-pref';
import { NOTIFICATION_REGISTRY } from '@/lib/notifications/notification-config';
import { openNotificationSettings } from '@/lib/notifications/push-token';
import { PushNudgeSheet } from '@/components/notifications/push-nudge-sheet';
import { useTheme } from '@/providers/theme-provider';
import { usePushConsent } from '@/providers/push-consent-provider';
import type { AppColors } from '@/lib/theme';

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
      fontSize: 19,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginRight: 40,
    },
    scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
    emptyCard: { padding: 24, alignItems: 'center', gap: 8 },
    consentCard: {
      padding: 16,
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      marginBottom: 8,
    },
    consentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    consentIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.tealBg,
    },
    consentTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: C.text },
    consentBody: { fontSize: 14, color: C.textMuted, lineHeight: 20 },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.inputBg,
    },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
    emptyDesc: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: prefs = [], isLoading } = useNotificationPrefs();
  const { mutate: updatePref } = useUpdateNotificationPref();
  const {
    isPushEnabled,
    isOsPermissionDenied,
    isOsPermissionUndetermined,
    isToggling,
    toggle: togglePush,
  } = usePushToggle();
  const { requestPushConsent } = usePushConsent();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [nudgeVisible, setNudgeVisible] = useState(false);

  // Local muted state for category-level preferences.
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

  const toggle = useCallback(
    (key: string) => {
      const next = !mutedMap[key];
      setMutedMap((prev) => ({ ...prev, [key]: next }));
      updatePref({ prefKey: key, muted: next });
    },
    [mutedMap, updatePref],
  );
  const handleMasterPushPress = useCallback(() => {
    if (isOsPermissionDenied) {
      setNudgeVisible(true);
      return;
    }
    if (isOsPermissionUndetermined && !isPushEnabled) {
      void requestPushConsent();
      return;
    }
    void togglePush();
  }, [
    isOsPermissionDenied,
    isOsPermissionUndetermined,
    isPushEnabled,
    requestPushConsent,
    togglePush,
  ]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.navTitle}>Notifications</Text>
        </View>
        <NotificationSettingsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Push master toggle */}
        <Text style={s.sectionLabel}>Push Notifications</Text>
        {!isPushEnabled && (
          <TouchableOpacity
            style={s.consentCard}
            onPress={handleMasterPushPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Turn on class reminders"
          >
            <View style={s.consentHeader}>
              <View style={s.consentIconWrap}>
                <Bell size={20} color={colors.teal} />
              </View>
              <Text style={s.consentTitle}>Turn on class reminders</Text>
            </View>
            <Text style={s.consentBody}>
              Get reminders before sessions, tutor messages, and schedule changes. No
              marketing notifications.
            </Text>
          </TouchableOpacity>
        )}
        <View style={s.card}>
          {isOsPermissionDenied ? (
            <SettingsRow
              icon={<BellOff size={20} color={colors.textFaint} />}
              label="Class reminders"
              labelColor={colors.textFaint}
              hideChevron
              onPress={handleMasterPushPress}
              trailing={
                <Switch
                  value={false}
                  disabled
                  trackColor={{ false: colors.switchTrackOff, true: colors.teal }}
                  thumbColor="#ffffff"
                />
              }
            />
          ) : (
            <SettingsRow
              icon={<Bell size={20} color={colors.textMuted} />}
              label="Class reminders"
              labelColor={colors.text}
              hideChevron
              onPress={handleMasterPushPress}
              trailing={
                <Switch
                  value={isPushEnabled}
                  onValueChange={handleMasterPushPress}
                  disabled={isToggling}
                  trackColor={{ false: colors.switchTrackOff, true: colors.teal }}
                  thumbColor="#ffffff"
                />
              }
            />
          )}
        </View>

        {/* Per-category preferences */}
        {(prefs as Record<string, unknown>[]).length === 0 ? (
          <>
            <Text style={s.sectionLabel}>Categories</Text>
            <View style={[s.card, s.emptyCard]}>
              <View style={s.emptyIconWrap}>
                <Bell size={28} color={colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No preferences configured</Text>
              <Text style={s.emptyDesc}>
                Notification categories will appear here once they are available for your
                account.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={s.sectionLabel}>Categories</Text>
            <View style={s.card}>
              {(prefs as Record<string, unknown>[]).map((pref, i) => {
                const key = pref.pref_key as string;
                const label = NOTIFICATION_REGISTRY[key]?.label ?? key;
                const isMuted = mutedMap[key] ?? (pref.muted as boolean) ?? false;
                const icon = isMuted ? (
                  <BellOff size={20} color={colors.textFaint} />
                ) : (
                  <Bell size={20} color={colors.textMuted} />
                );
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
          </>
        )}
      </ScrollView>

      <PushNudgeSheet
        visible={nudgeVisible}
        variant="open-settings"
        onEnable={() => {}}
        onOpenSettings={async () => {
          setNudgeVisible(false);
          await openNotificationSettings();
        }}
        onDismiss={() => setNudgeVisible(false)}
      />
    </SafeAreaView>
  );
}
