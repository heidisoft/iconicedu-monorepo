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
import { getLearningSpaceIcon } from '@/lib/learning-space-icons';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { RoleAvatarBadge } from '@/components/profile/role-avatar-badge';
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
    groupBadgeFront: { top: -3 },
    groupBadgeBack: { top: -3 },

    // ── Channel/space icon ─────────────────────────────────────────────────────
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
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

// ─── Component ────────────────────────────────────────────────────────────────

export function ConversationHeader({
  title,
  subtitle,
  onSubtitlePress,
  localTimeLabel,
  kind,
  avatarSeed,
  avatarUrl,
  avatarRole,
  iconKey,
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
  const seed = avatarSeed ?? title;
  const LearningSpaceIcon = !isDm ? getLearningSpaceIcon(iconKey) : null;

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

  return (
    <View style={[s.container, isDm ? s.containerElevated : null]}>
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
        <View style={s.iconBox}>
          {LearningSpaceIcon ? <LearningSpaceIcon size={22} color={colors.teal} /> : null}
        </View>
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
            <Text style={s.title} numberOfLines={1}>
              {secondaryAvatarSeed ? `${secondaryAvatarSeed} <> ${title}` : title}
            </Text>
            {!!(subtitle || localTimeLabel) &&
              (onSubtitlePress ? (
                <TouchableOpacity
                  style={s.subtitleButton}
                  onPress={onSubtitlePress}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Explain local time"
                >
                  <View style={s.subtitleRow}>
                    {!!subtitle && <Text style={s.subtitleText}>{subtitle}</Text>}
                    {!!subtitle && !!localTimeLabel && (
                      <Text style={s.subtitleSeparator}>{'\u00b7'}</Text>
                    )}
                    {!!localTimeLabel && (
                      <View style={s.localTimeWrap}>
                        <Text
                          style={s.localTimeText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {localTimeLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={s.subtitleRow}>
                  {!!subtitle && <Text style={s.subtitleText}>{subtitle}</Text>}
                  {!!subtitle && !!localTimeLabel && (
                    <Text style={s.subtitleSeparator}>{'\u00b7'}</Text>
                  )}
                  {!!localTimeLabel && (
                    <View style={s.localTimeWrap}>
                      <Text
                        style={s.localTimeText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {localTimeLabel}
                      </Text>
                    </View>
                  )}
                </View>
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
