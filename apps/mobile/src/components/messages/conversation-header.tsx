import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
  Platform,
} from 'react-native';
import { ChevronLeft, Video, MoreVertical } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { LearningSpaceIconBadge } from '@/lib/learning-space-icons';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { RoleAvatarBadge } from '@/components/profile/role-avatar-badge';
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';
import type { PresenceDisplayStatus } from '@/hooks/use-online-profile-ids';

// ─── Avatar color helpers (same palette as messages list) ────────────────────

const AVATAR_COLORS = [
  '#5B8DEF',
  '#E07B54',
  '#6CC070',
  '#A86CC1',
  '#E0A854',
  '#54B8C4',
  '#E06C8A',
];

const THEME_KEY_COLORS: Record<string, { bg: string; fg: string }> = {
  slate: { bg: '#64748b', fg: '#ffffff' },
  gray: { bg: '#6b7280', fg: '#ffffff' },
  zinc: { bg: '#71717a', fg: '#ffffff' },
  neutral: { bg: '#737373', fg: '#ffffff' },
  stone: { bg: '#78716c', fg: '#ffffff' },
  red: { bg: '#ef4444', fg: '#ffffff' },
  orange: { bg: '#f97316', fg: '#ffffff' },
  amber: { bg: '#f59e0b', fg: '#1f2937' },
  yellow: { bg: '#eab308', fg: '#1f2937' },
  lime: { bg: '#84cc16', fg: '#1f2937' },
  green: { bg: '#22c55e', fg: '#ffffff' },
  emerald: { bg: '#10b981', fg: '#ffffff' },
  teal: { bg: '#14b8a6', fg: '#ffffff' },
  cyan: { bg: '#06b6d4', fg: '#ffffff' },
  sky: { bg: '#0ea5e9', fg: '#ffffff' },
  blue: { bg: '#3b82f6', fg: '#ffffff' },
  indigo: { bg: '#6366f1', fg: '#ffffff' },
  violet: { bg: '#8b5cf6', fg: '#ffffff' },
  purple: { bg: '#a855f7', fg: '#ffffff' },
  fuchsia: { bg: '#d946ef', fg: '#ffffff' },
  pink: { bg: '#ec4899', fg: '#ffffff' },
  rose: { bg: '#f43f5e', fg: '#ffffff' },
};

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
  studentProfiles?: Array<{ name: string; themeKey?: string | null }> | null;
  onSubtitlePress?: (() => void) | null;
  localTimeLabel?: string | null;
  kind: 'dm' | 'channel' | 'space';
  /** DM: seed used for avatar background color. Defaults to title. */
  avatarSeed?: string | null;
  /** DM: profile photo URL — shown instead of initials when available. */
  avatarUrl?: string | null;
  /** DM: role used for the avatar badge. */
  avatarRole?: string | null;
  /** Channel/space: learning-space icon key */
  iconKey?: string | null;
  /** Channel/space: UI theme key */
  themeKey?: string | null;
  onBack: () => void;
  onCall?: () => void;
  onVideo?: () => void;
  onMore?: () => void;
  /**
   * When provided, replaces the Video icon button with a "Join" pill button
   * that opens this URL — mirrors web MessagesContainerHeaderActions join button
   * (shown when channel.context?.liveSession?.enabled === true).
   */
  liveJoinUrl?: string | null;
  /**
   * When provided alongside `kind="dm"`, renders a stacked dual-avatar
   * (primary = avatarSeed/title, secondary = this seed). Used for supervised DMs
   * where both the child and the partner's initials are shown.
   */
  secondaryAvatarSeed?: string | null;
  secondaryAvatarRole?: string | null;
  presenceStatus?: PresenceDisplayStatus | null;
  /** When true, hides all action buttons and the online dot (supervised read-only mode). */
  isReadOnly?: boolean;
  loading?: boolean;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 10,
      backgroundColor: C.pageBg,
      gap: 4,
    },
    containerElevated: {
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: Platform.OS === 'ios' ? 0 : 0.08,
      shadowRadius: Platform.OS === 'ios' ? 0 : 6,
      elevation: Platform.OS === 'android' ? 3 : 0,
      zIndex: 2,
    },
    backBtn: {
      width: 40,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
    },
    backArrow: { fontSize: 26, color: C.text, fontWeight: '300', lineHeight: 30 },

    // ── DM avatar ──────────────────────────────────────────────────────────────
    avatarWrap: { position: 'relative', width: 42, height: 42, flexShrink: 0 },
    avatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
    onlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#22c55e',
      borderWidth: 2,
      borderColor: C.pageBg,
    },
    statusBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.pageBg,
    },

    // ── DM avatar — grouped (supervised: child + partner stacked) ──────────────
    groupWrap: { width: 52, height: 52, flexShrink: 0, position: 'relative' },
    groupBack: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.pageBg,
    },
    groupFront: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.pageBg,
    },
    groupTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
    groupBadgeFront: {},
    groupBadgeBack: {},

    // ── Channel/space icon ─────────────────────────────────────────────────────
    iconBox: {
      flexShrink: 0,
    },
    // ── Title block ────────────────────────────────────────────────────────────
    titleBlock: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 8,
      paddingRight: 8,
      justifyContent: 'center',
      gap: 2,
    },
    title: { fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
    subtitle: { fontSize: 12, color: C.textMuted },
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      minWidth: 0,
    },
    subtitleText: { fontSize: 12, color: C.textMuted, flexShrink: 0 },
    subtitleSeparator: { fontSize: 12, color: C.textMuted },
    localTimeWrap: { flexShrink: 1, minWidth: 0 },
    localTimeText: { fontSize: 12, color: C.textMuted, flexShrink: 1 },
    subtitleButton: { alignSelf: 'stretch', minWidth: 0 },
    titleSkeletonWrap: { gap: 6, paddingTop: 2 },

    // ── Action buttons ─────────────────────────────────────────────────────────
    actions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
    actionBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    actionIcon: { fontSize: 19, color: C.text },
    moreIcon: { fontSize: 24, color: C.text },

    // ── Live session join pill — mirrors web MessagesContainerHeaderActions Join button ──
    joinPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: C.tealBg,
    },
    joinPillTxt: { fontSize: 13, fontWeight: '700', color: C.teal },
  });
}

function themeTextColor(themeKey: string | null | undefined, fallback: string): string {
  const palette: Record<string, string> = {
    slate: '#64748b',
    gray: '#6b7280',
    zinc: '#71717a',
    neutral: '#737373',
    stone: '#78716c',
    red: '#ef4444',
    orange: '#f97316',
    amber: '#f59e0b',
    yellow: '#ca8a04',
    lime: '#65a30d',
    green: '#16a34a',
    emerald: '#059669',
    teal: '#0f766e',
    cyan: '#0891b2',
    sky: '#0284c7',
    blue: '#2563eb',
    indigo: '#4f46e5',
    violet: '#7c3aed',
    purple: '#9333ea',
    fuchsia: '#c026d3',
    pink: '#db2777',
    rose: '#e11d48',
  };
  return (themeKey && palette[themeKey]) || fallback;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConversationHeader({
  title,
  subtitle,
  studentProfiles,
  onSubtitlePress,
  localTimeLabel,
  kind,
  avatarSeed,
  avatarUrl,
  avatarRole,
  iconKey,
  themeKey,
  onBack,
  onCall: _onCall,
  onVideo,
  onMore,
  liveJoinUrl,
  secondaryAvatarSeed,
  secondaryAvatarRole,
  presenceStatus,
  isReadOnly = false,
  loading = false,
}: ConversationHeaderProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const isDm = kind === 'dm';
  const useElevatedHeader = kind !== 'space';
  const seed = avatarSeed ?? title;
  const iconTheme =
    !isDm && themeKey && THEME_KEY_COLORS[themeKey]
      ? THEME_KEY_COLORS[themeKey]
      : { bg: colors.inputBg, fg: colors.text };

  const presenceBadge = useMemo(() => {
    if (!presenceStatus || isReadOnly) return null;
    if (presenceStatus === 'online') {
      return <View style={s.onlineDot} />;
    }
    if (presenceStatus === 'away' || presenceStatus === 'idle') {
      return <View style={[s.statusBadge, { backgroundColor: '#eab308' }]} />;
    }
    if (presenceStatus === 'busy') {
      return <View style={[s.statusBadge, { backgroundColor: '#dc2626' }]} />;
    }
    return <View style={[s.statusBadge, { backgroundColor: '#4b5563' }]} />;
  }, [isReadOnly, presenceStatus, s]);
  const subtitleStudents =
    studentProfiles?.filter((student) => student.name.trim().length > 0) ?? [];
  const hasSubtitleStudents = subtitleStudents.length > 0;
  const subtitleContent = (
    <View style={s.subtitleRow}>
      {!!subtitle && (
        <Text style={s.subtitleText} numberOfLines={1} ellipsizeMode="tail">
          {subtitle}
        </Text>
      )}
      {!!subtitle && hasSubtitleStudents && (
        <Text style={s.subtitleSeparator}>{'\u00b7'}</Text>
      )}
      {hasSubtitleStudents && (
        <Text style={s.localTimeText} numberOfLines={1} ellipsizeMode="tail">
          {subtitleStudents.map((student, index) => (
            <Text
              key={`${student.name}-${index}`}
              style={{
                color: themeTextColor(student.themeKey, colors.textMuted),
              }}
            >
              {index > 0 ? ', ' : ''}
              {student.name}
            </Text>
          ))}
        </Text>
      )}
      {!!(subtitle || hasSubtitleStudents) && !!localTimeLabel && (
        <Text style={s.subtitleSeparator}>{'\u00b7'}</Text>
      )}
      {!!localTimeLabel && (
        <View style={s.localTimeWrap}>
          <Text style={s.localTimeText} numberOfLines={1} ellipsizeMode="tail">
            {localTimeLabel}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[s.container, useElevatedHeader ? s.containerElevated : null]}>
      {/* Back */}
      <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={8}>
        <ChevronLeft size={28} color={colors.text} />
      </TouchableOpacity>

      {/* Avatar (DM) or icon box (channel/space) */}
      {isDm && secondaryAvatarSeed ? (
        // Supervised DM — stacked dual avatar: partner (front-left) + child (back-right)
        <View style={s.groupWrap}>
          <View
            style={[s.groupBack, { backgroundColor: avatarColor(secondaryAvatarSeed) }]}
          >
            <Text style={s.groupTxt}>{getInitials(secondaryAvatarSeed)}</Text>
          </View>
          <RoleAvatarBadge
            role={secondaryAvatarRole}
            size={14}
            style={s.groupBadgeBack}
          />
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.groupFront} />
          ) : (
            <View style={[s.groupFront, { backgroundColor: avatarColor(seed) }]}>
              <Text style={s.groupTxt}>{getInitials(title)}</Text>
            </View>
          )}
          <RoleAvatarBadge role={avatarRole} size={14} style={s.groupBadgeFront} />
        </View>
      ) : isDm ? (
        // Regular DM — single avatar with optional photo
        <View style={s.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatarCircle} />
          ) : (
            <View style={[s.avatarCircle, { backgroundColor: avatarColor(seed) }]}>
              <Text style={s.avatarTxt}>{getInitials(title)}</Text>
            </View>
          )}
          {presenceBadge}
          <RoleAvatarBadge role={avatarRole} size={16} />
        </View>
      ) : (
        <LearningSpaceIconBadge
          iconKey={iconKey}
          size={42}
          iconSize={22}
          borderRadius={21}
          backgroundColor={iconTheme.bg}
          color={iconTheme.fg}
          style={s.iconBox}
        />
      )}

      {/* Title + subtitle */}
      <View style={s.titleBlock}>
        {loading ? (
          <View style={s.titleSkeletonWrap}>
            <PulseBox width={148} height={16} radius={5} />
            <PulseBox width={96} height={12} radius={5} />
          </View>
        ) : (
          <>
            <RoleNameIndicator
              name={secondaryAvatarSeed ? `${secondaryAvatarSeed} <> ${title}` : title}
              role={avatarRole}
              iconSize={14}
              textStyle={s.title}
              numberOfLines={1}
            />
            {!!(subtitle || hasSubtitleStudents || localTimeLabel) &&
              (onSubtitlePress ? (
                <TouchableOpacity
                  style={s.subtitleButton}
                  onPress={onSubtitlePress}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Explain local time"
                >
                  {subtitleContent}
                </TouchableOpacity>
              ) : (
                subtitleContent
              ))}
          </>
        )}
      </View>

      {/* Action buttons — hidden in read-only/supervised mode */}
      {!isReadOnly && (
        <View style={s.actions}>
          {/* Join pill when live session active — mirrors web header Join button */}
          {liveJoinUrl ? (
            <TouchableOpacity
              style={s.joinPill}
              onPress={() => Linking.openURL(liveJoinUrl).catch(() => null)}
              activeOpacity={0.85}
              accessibilityLabel="Join live session"
            >
              <Video size={14} color={colors.teal} />
              <Text style={s.joinPillTxt}>Join</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.actionBtn} onPress={onVideo} hitSlop={8}>
              <Video size={20} color={colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.actionBtn} onPress={onMore} hitSlop={8}>
            <MoreVertical size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
