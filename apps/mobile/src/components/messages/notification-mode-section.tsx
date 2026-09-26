import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AtSign, Bell, BellOff, Check, Clock } from 'lucide-react-native';
import type { NotificationConversationMode } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import {
  fetchConversationNotificationMode,
  setConversationNotificationMode,
} from '@/lib/api/queries';
import { reportMobileObservedError } from '@/lib/analytics/report-error';

export type NotificationScopeKind = 'channel' | 'learning_space';

const HOUR_MS = 60 * 60 * 1000;

type ModeOption = {
  key: string;
  label: string;
  mode: NotificationConversationMode;
  durationMs?: number;
};

export const NOTIFICATION_MODE_OPTIONS: ModeOption[] = [
  { key: 'normal', label: 'Normal', mode: 'normal' },
  { key: 'mentions_only', label: 'Mentions only', mode: 'mentions_only' },
  { key: 'mute_1h', label: 'Mute for 1 hour', mode: 'muted_until', durationMs: HOUR_MS },
  {
    key: 'mute_8h',
    label: 'Mute for 8 hours',
    mode: 'muted_until',
    durationMs: 8 * HOUR_MS,
  },
  {
    key: 'mute_24h',
    label: 'Mute for 24 hours',
    mode: 'muted_until',
    durationMs: 24 * HOUR_MS,
  },
  {
    key: 'mute_1w',
    label: 'Mute for 1 week',
    mode: 'muted_until',
    durationMs: 7 * 24 * HOUR_MS,
  },
  {
    key: 'mute_until_enabled',
    label: 'Mute until I turn it back on',
    mode: 'muted_until_enabled',
  },
];

function formatMutedUntil(mutedUntil: string | null): string | null {
  if (!mutedUntil) return null;
  const date = new Date(mutedUntil);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Human-readable summary of the current mode, shown on the collapsed row. */
export function describeNotificationMode(
  mode: NotificationConversationMode,
  mutedUntil: string | null,
): string {
  if (mode === 'mentions_only') return 'Mentions only';
  if (mode === 'muted_until_enabled') return 'Muted';
  if (mode === 'muted_until') {
    const until = formatMutedUntil(mutedUntil);
    return until ? `Muted until ${until}` : 'Muted';
  }
  return 'Normal';
}

export function isMutedNotificationMode(mode: NotificationConversationMode): boolean {
  return mode === 'muted_until' || mode === 'muted_until_enabled';
}

export function buildConversationModePayload(option: ModeOption, now = Date.now()) {
  return {
    mode: option.mode,
    mutedUntil: option.durationMs
      ? new Date(now + option.durationMs).toISOString()
      : undefined,
  };
}

export function NotificationModeSection({
  orgId,
  profileId,
  scopeKind,
  scopeId,
}: {
  orgId: string;
  profileId: string;
  scopeKind: NotificationScopeKind;
  scopeId: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<NotificationConversationMode>('normal');
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const canQuery = !!orgId && !!profileId && !!scopeId;

  useEffect(() => {
    if (!canQuery) return;
    let cancelled = false;
    setLoading(true);

    fetchConversationNotificationMode({ orgId, profileId, scopeKind, scopeId })
      .then((result) => {
        if (cancelled) return;
        setMode(result?.mode ?? 'normal');
        setMutedUntil(result?.mutedUntil ?? null);
      })
      .catch((error) => {
        if (cancelled) return;
        // Fall back to "Normal" — the control stays usable.
        setMode('normal');
        setMutedUntil(null);
        reportMobileObservedError({
          error,
          source: 'mobile.messages.notification_mode.load',
          message: 'Failed to load conversation notification mode',
          context: { scopeKind, scopeId },
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canQuery, orgId, profileId, scopeKind, scopeId]);

  const applyMode = useCallback(
    async (nextMode: NotificationConversationMode, nextMutedUntil?: string) => {
      if (!canQuery) return;
      const previousMode = mode;
      const previousMutedUntil = mutedUntil;

      setMode(nextMode);
      setMutedUntil(nextMutedUntil ?? null);
      setSaving(true);
      try {
        await setConversationNotificationMode({
          orgId,
          profileId,
          scopeKind,
          scopeId,
          mode: nextMode,
          mutedUntil: nextMutedUntil,
        });
      } catch (error) {
        setMode(previousMode);
        setMutedUntil(previousMutedUntil);
        reportMobileObservedError({
          error,
          source: 'mobile.messages.notification_mode.save',
          message: 'Failed to save conversation notification mode',
          context: { scopeKind, scopeId, mode: nextMode },
        });
      } finally {
        setSaving(false);
      }
    },
    [canQuery, mode, mutedUntil, orgId, profileId, scopeKind, scopeId],
  );

  const handleSelectOption = useCallback(
    async (option: ModeOption) => {
      setPickerVisible(false);
      const payload = buildConversationModePayload(option);
      await applyMode(payload.mode, payload.mutedUntil);
    },
    [applyMode],
  );

  const handleUnmute = useCallback(() => {
    void applyMode('normal');
  }, [applyMode]);

  const isMuted = isMutedNotificationMode(mode);
  const summary = describeNotificationMode(mode, mutedUntil);
  const Icon = isMuted ? BellOff : mode === 'mentions_only' ? AtSign : Bell;

  return (
    <View style={s.section} testID="notification-mode-section">
      <TouchableOpacity
        style={s.row}
        activeOpacity={0.7}
        onPress={() => setPickerVisible(true)}
        disabled={!canQuery}
        accessibilityRole="button"
        accessibilityLabel="Change notification settings"
      >
        <Icon size={18} color={colors.textMuted} />
        <Text style={s.rowLabel}>Notifications</Text>
        {loading || saving ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <Text style={s.rowValue} numberOfLines={1}>
            {summary}
          </Text>
        )}
      </TouchableOpacity>

      {isMuted && (
        <>
          <View style={s.rowSep} />
          <TouchableOpacity
            style={s.row}
            activeOpacity={0.7}
            onPress={handleUnmute}
            accessibilityRole="button"
            accessibilityLabel="Turn on notifications"
          >
            <Bell size={18} color={colors.teal} />
            <Text style={[s.rowLabel, { color: colors.teal, fontWeight: '600' }]}>
              Turn on notifications
            </Text>
          </TouchableOpacity>
        </>
      )}

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={s.overlay} onPress={() => setPickerVisible(false)}>
          <Pressable>
            <View style={s.sheet}>
              <View style={s.handle} />
              <Text style={s.sheetTitle}>Notifications</Text>
              {NOTIFICATION_MODE_OPTIONS.map((option) => {
                const isSelected =
                  option.mode === mode &&
                  // Any "Mute for …" option maps to the same stored mode, so only
                  // flag the generic muted state rather than a specific duration.
                  (option.mode !== 'muted_until' || option.key === 'mute_1h');
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={s.optionRow}
                    activeOpacity={0.7}
                    onPress={() => void handleSelectOption(option)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                  >
                    {option.mode === 'normal' ? (
                      <Bell size={18} color={colors.text} />
                    ) : option.mode === 'mentions_only' ? (
                      <AtSign size={18} color={colors.text} />
                    ) : option.mode === 'muted_until' ? (
                      <Clock size={18} color={colors.text} />
                    ) : (
                      <BellOff size={18} color={colors.text} />
                    )}
                    <Text style={s.optionLabel}>{option.label}</Text>
                    {isSelected && <Check size={18} color={colors.teal} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C: AppColors) {
  const hairline = StyleSheet.hairlineWidth;
  return StyleSheet.create({
    section: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: C.card,
      borderWidth: hairline,
      borderColor: C.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowSep: { height: hairline, backgroundColor: C.border, marginLeft: 16 },
    rowLabel: { flex: 1, fontSize: 15, color: C.textMuted },
    rowValue: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
      maxWidth: 200,
      textAlign: 'right',
    },

    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.modalOverlay },
    sheet: {
      backgroundColor: C.pageBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 40,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 12,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    optionLabel: { flex: 1, fontSize: 17, color: C.text },
  });
}
