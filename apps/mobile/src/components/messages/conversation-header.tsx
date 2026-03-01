import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, Video, MoreVertical } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

// ─── Avatar color helpers (same palette as messages list) ────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConversationHeaderProps = {
  title: string;
  /** Subtitle — e.g. "Direct Message" or space subject */
  subtitle?: string | null;
  kind: 'dm' | 'channel' | 'space';
  /** DM: seed used for avatar background color. Defaults to title. */
  avatarSeed?: string | null;
  /** Channel/space: emoji icon shown instead of initials */
  iconEmoji?: string | null;
  onBack: () => void;
  onCall?: () => void;
  onVideo?: () => void;
  onMore?: () => void;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 10,
      backgroundColor: C.teal,
      gap: 4,
    },
    backBtn: {
      width: 40, height: 44,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 22,
    },
    backArrow: { fontSize: 26, color: '#fff', fontWeight: '300', lineHeight: 30 },

    // ── DM avatar ──────────────────────────────────────────────────────────────
    avatarWrap:   { position: 'relative', width: 42, height: 42, flexShrink: 0 },
    avatarCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:    { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
    onlineDot: {
      position: 'absolute', bottom: 0, right: 0,
      width: 12, height: 12, borderRadius: 6,
      backgroundColor: '#22c55e',
      borderWidth: 2, borderColor: C.teal,
    },

    // ── Channel/space icon ─────────────────────────────────────────────────────
    iconBox: {
      width: 42, height: 42, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    iconEmojiTxt: { fontSize: 22 },

    // ── Title block ────────────────────────────────────────────────────────────
    titleBlock: { flex: 1, paddingLeft: 8, justifyContent: 'center', gap: 2 },
    title:      { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
    subtitle:   { fontSize: 12, color: 'rgba(255,255,255,0.78)' },

    // ── Action buttons ─────────────────────────────────────────────────────────
    actions: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: {
      width: 40, height: 40,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 20,
    },
    actionIcon: { fontSize: 19, color: 'rgba(255,255,255,0.9)' },
    moreIcon:   { fontSize: 24, color: 'rgba(255,255,255,0.9)' },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConversationHeader({
  title,
  subtitle,
  kind,
  avatarSeed,
  iconEmoji,
  onBack,
  onCall,
  onVideo,
  onMore,
}: ConversationHeaderProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const isDm = kind === 'dm';
  const seed = avatarSeed ?? title;

  return (
    <View style={s.container}>
      {/* Back */}
      <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={8}>
        <ChevronLeft size={28} color="#fff" />
      </TouchableOpacity>

      {/* Avatar (DM) or icon box (channel/space) */}
      {isDm ? (
        <View style={s.avatarWrap}>
          <View style={[s.avatarCircle, { backgroundColor: avatarColor(seed) }]}>
            <Text style={s.avatarTxt}>{getInitials(title)}</Text>
          </View>
          <View style={s.onlineDot} />
        </View>
      ) : (
        <View style={s.iconBox}>
          <Text style={s.iconEmojiTxt}>{iconEmoji ?? (kind === 'space' ? '🚀' : '📚')}</Text>
        </View>
      )}

      {/* Title + subtitle */}
      <View style={s.titleBlock}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>

      {/* Action buttons — Phone removed, keep Video and MoreVertical */}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={onVideo} hitSlop={8}>
          <Video size={20} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={onMore} hitSlop={8}>
          <MoreVertical size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
