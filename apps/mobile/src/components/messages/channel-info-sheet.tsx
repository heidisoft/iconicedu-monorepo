import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

const AVATAR_COLORS = ['#5B8DEF', '#E07B54', '#6CC070', '#A86CC1', '#E0A854', '#54B8C4', '#E06C8A'];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name[0]?.toUpperCase() ?? '?';
}

export type ChannelInfoSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  kind: 'dm' | 'channel' | 'space';
  avatarSeed?: string | null;
  iconEmoji?: string | null;
  memberCount?: number | null;
  description?: string | null;
  onClose: () => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 12,
      overflow: 'hidden',
    },
    handle: {
      alignSelf: 'center',
      width: 36, height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      marginBottom: 16,
    },
    // ── Hero section ──────────────────────────────────────────────────────────
    hero: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 24,
      gap: 10,
    },
    avatarCircle: {
      width: 72, height: 72,
      borderRadius: 36,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarTxt:  { color: '#fff', fontWeight: '700', fontSize: 28 },
    iconBox: {
      width: 72, height: 72,
      borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    iconEmojiTxt: { fontSize: 36 },
    heroName:   { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
    heroSub:    { fontSize: 14, color: C.textMuted, textAlign: 'center' },

    // ── Info rows ─────────────────────────────────────────────────────────────
    section: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
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
    rowSep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 16 },
    rowIcon:  { fontSize: 18, width: 24, textAlign: 'center' },
    rowLabel: { flex: 1, fontSize: 14, color: C.textMuted },
    rowValue: { fontSize: 14, fontWeight: '600', color: C.text, maxWidth: 200, textAlign: 'right' },

    // ── Close button ──────────────────────────────────────────────────────────
    closeBtn: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 12,
      backgroundColor: C.inputBg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    closeTxt: { fontSize: 15, fontWeight: '600', color: C.text },
  });
}

export function ChannelInfoSheet({
  visible,
  title,
  subtitle,
  kind,
  avatarSeed,
  iconEmoji,
  memberCount,
  description,
  onClose,
}: ChannelInfoSheetProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const isDm = kind === 'dm';
  const seed = avatarSeed ?? title;
  const typeLabel = isDm ? 'Direct Message' : kind === 'space' ? 'Learning Space' : 'Channel';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={s.handle} />

              {/* Hero */}
              <View style={s.hero}>
                {isDm ? (
                  <View style={[s.avatarCircle, { backgroundColor: avatarColor(seed) }]}>
                    <Text style={s.avatarTxt}>{getInitials(title)}</Text>
                  </View>
                ) : (
                  <View style={[s.iconBox, { backgroundColor: colors.tealBg }]}>
                    <Text style={s.iconEmojiTxt}>{iconEmoji ?? '📚'}</Text>
                  </View>
                )}
                <Text style={s.heroName}>{title}</Text>
                {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
              </View>

              {/* Info rows */}
              <View style={s.section}>
                <View style={s.row}>
                  <Text style={s.rowIcon}>{isDm ? '💬' : '📋'}</Text>
                  <Text style={s.rowLabel}>Type</Text>
                  <Text style={s.rowValue}>{typeLabel}</Text>
                </View>
                {memberCount != null && (
                  <>
                    <View style={s.rowSep} />
                    <View style={s.row}>
                      <Text style={s.rowIcon}>👥</Text>
                      <Text style={s.rowLabel}>Members</Text>
                      <Text style={s.rowValue}>{memberCount}</Text>
                    </View>
                  </>
                )}
                {!!description && (
                  <>
                    <View style={s.rowSep} />
                    <View style={s.row}>
                      <Text style={s.rowIcon}>📝</Text>
                      <Text style={s.rowLabel}>Description</Text>
                      <Text style={s.rowValue} numberOfLines={2}>{description}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Close */}
              <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={s.closeTxt}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
