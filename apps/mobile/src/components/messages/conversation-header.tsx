import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
  Platform,
  Modal,
  Pressable,
  Share,
  type LayoutChangeEvent,
} from 'react-native';
import {
  ChevronLeft,
  Video,
  MoreVertical,
  Share2,
  X,
  Clock3,
  Sunrise,
  Sun,
  Sunset,
  MoonStar,
  CircleOff,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { ChannelTopicIconBadge } from '@/lib/learning-space-icons';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { RoleAvatarBadge } from '@/components/profile/role-avatar-badge';
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';
import type { PresenceDisplayStatus } from '@/hooks/use-online-profile-ids';

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

function isExternalJoinHref(joinHref?: string | null): boolean {
  return Boolean(joinHref && /^https?:\/\//i.test(joinHref));
}

function resolveExternalJoinProviderLabel(joinHref?: string | null) {
  if (!joinHref || !isExternalJoinHref(joinHref)) {
    return null;
  }

  try {
    const hostname = new URL(joinHref).hostname.toLowerCase();
    if (hostname.includes('zoom')) return 'Zoom';
    if (hostname.includes('jitsi')) return 'Jitsi';
    if (hostname.includes('meet.google')) return 'Google Meet';
    if (hostname.includes('teams.microsoft')) return 'Microsoft Teams';
  } catch {
    return null;
  }

  return null;
}

export type ConversationHeaderProps = {
  title: string;
  subtitle?: string | null;
  studentProfiles?: Array<{ name: string; themeKey?: string | null }> | null;
  localTimeLabel?: string | null;
  localTimeIcon?:
    | 'clock'
    | 'morning'
    | 'day'
    | 'evening'
    | 'off-hours'
    | 'offline'
    | null;
  kind: 'dm' | 'channel' | 'space';
  avatarSeed?: string | null;
  avatarUrl?: string | null;
  avatarRole?: string | null;
  iconKey?: string | null;
  themeKey?: string | null;
  onBack: () => void;
  onCall?: () => void;
  onVideo?: () => void;
  onMore?: () => void;
  liveJoinUrl?: string | null;
  secondaryAvatarSeed?: string | null;
  secondaryAvatarRole?: string | null;
  presenceStatus?: PresenceDisplayStatus | null;
  isReadOnly?: boolean;
  loading?: boolean;
};

type AutoScrollingInlineTextProps = {
  children: React.ReactNode;
  viewportStyle: object;
  trackStyle: object;
  contentStyle?: object;
  testIDPrefix?: string;
};

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
    iconBox: {
      flexShrink: 0,
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 8,
      paddingRight: 8,
      justifyContent: 'center',
      gap: 2,
    },
    title: { fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
    subtitleRow: {
      flexShrink: 1,
      minWidth: 0,
    },
    subtitleText: { fontSize: 12, lineHeight: 16, color: C.textMuted },
    subtitleSeparator: { fontSize: 12, lineHeight: 16, color: C.textMuted },
    localTimeText: { fontSize: 12, lineHeight: 16, color: C.textMuted },
    localTimeWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'center',
    },
    subtitleInlineContent: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    tooltipText: {
      fontSize: 12,
      lineHeight: 18,
      color: '#f8fafc',
    },
    subtitleButton: { alignSelf: 'stretch', minWidth: 0 },
    subtitleViewport: {
      overflow: 'hidden',
      flexShrink: 1,
      minWidth: 0,
    },
    subtitleTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    titleSkeletonWrap: { gap: 6, paddingTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
    actionBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
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
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: 'rgba(15, 23, 42, 0.42)',
    },
    modalCard: {
      gap: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      padding: 20,
    },
    modalHeading: { gap: 8 },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: C.text,
    },
    modalDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: C.textMuted,
    },
    modalLinkBox: {
      gap: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
      padding: 14,
    },
    modalLinkLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: C.textMuted,
    },
    modalLinkValue: {
      fontSize: 13,
      lineHeight: 19,
      color: C.text,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 10,
    },
    modalButton: {
      minWidth: 104,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    modalButtonSecondary: {
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
    },
    modalButtonPrimary: {
      backgroundColor: C.teal,
    },
    modalButtonSecondaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: C.text,
    },
    modalButtonPrimaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: C.tealFg,
    },
    modalCloseIconButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
    },
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

function AutoScrollingInlineText({
  children,
  viewportStyle,
  trackStyle,
  contentStyle,
  testIDPrefix,
}: AutoScrollingInlineTextProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const overflow = Math.max(0, contentWidth - viewportWidth);
  const shouldAnimate = overflow > 12;

  useEffect(() => {
    animationRef.current?.stop();
    translateX.stopAnimation();
    translateX.setValue(0);

    if (!shouldAnimate) {
      return;
    }

    const duration = Math.max(5000, overflow * 30);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(translateX, {
          toValue: -overflow,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animationRef.current = animation;
    animation.start();

    return () => {
      animation.stop();
    };
  }, [overflow, shouldAnimate, translateX]);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportWidth(event.nativeEvent.layout.width);
  }, []);

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setContentWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View
      testID={testIDPrefix ? `${testIDPrefix}-viewport` : undefined}
      style={viewportStyle}
      onLayout={handleViewportLayout}
    >
      <Animated.View
        testID={testIDPrefix ? `${testIDPrefix}-track` : undefined}
        style={[trackStyle, { transform: [{ translateX }] }]}
        onLayout={handleTrackLayout}
      >
        <View style={contentStyle}>{children}</View>
      </Animated.View>
    </View>
  );
}

export function ConversationHeader({
  title,
  subtitle,
  studentProfiles,
  localTimeLabel,
  localTimeIcon,
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
  const [externalJoinTarget, setExternalJoinTarget] = useState<{
    joinHref: string;
    providerLabel: string | null;
  } | null>(null);

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
  const hasSubtitleMeta = Boolean(subtitle || hasSubtitleStudents || localTimeLabel);

  const LocalTimeIcon = useMemo(() => {
    switch (localTimeIcon) {
      case 'morning':
        return Sunrise;
      case 'day':
        return Sun;
      case 'evening':
        return Sunset;
      case 'off-hours':
        return MoonStar;
      case 'offline':
        return CircleOff;
      case 'clock':
      default:
        return Clock3;
    }
  }, [localTimeIcon]);

  const handleOpenJoinHref = useCallback((joinHref: string) => {
    Linking.openURL(joinHref).catch(() => null);
  }, []);

  const handleJoinPress = useCallback(() => {
    if (!liveJoinUrl) return;
    if (isExternalJoinHref(liveJoinUrl)) {
      setExternalJoinTarget({
        joinHref: liveJoinUrl,
        providerLabel: resolveExternalJoinProviderLabel(liveJoinUrl),
      });
      return;
    }
    handleOpenJoinHref(liveJoinUrl);
  }, [handleOpenJoinHref, liveJoinUrl]);
  const handleShareJoinHref = useCallback(async () => {
    if (!externalJoinTarget?.joinHref) return;
    try {
      await Share.share({
        message: externalJoinTarget.joinHref,
        url: externalJoinTarget.joinHref,
      });
    } catch {
      // best effort share
    }
  }, [externalJoinTarget?.joinHref]);

  const subtitleContent = (
    <View style={s.subtitleRow}>
      <AutoScrollingInlineText
        viewportStyle={s.subtitleViewport}
        trackStyle={s.subtitleTrack}
        contentStyle={s.subtitleInlineContent}
        testIDPrefix="conversation-subtitle"
      >
        {!!subtitle && <Text style={s.subtitleText}>{subtitle}</Text>}
        {!!subtitle && hasSubtitleStudents && (
          <Text style={s.subtitleSeparator}>{' \u00b7 '}</Text>
        )}
        {hasSubtitleStudents &&
          subtitleStudents.map((student, index) => (
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
        {!!(subtitle || hasSubtitleStudents) && !!localTimeLabel && (
          <Text style={s.subtitleSeparator}>{' \u00b7 '}</Text>
        )}
        {!!localTimeLabel && (
          <View style={s.localTimeWrap}>
            <LocalTimeIcon size={12} color={colors.textMuted} strokeWidth={2} />
            <Text style={s.localTimeText}>{localTimeLabel}</Text>
          </View>
        )}
      </AutoScrollingInlineText>
    </View>
  );

  return (
    <>
      <View style={[s.container, useElevatedHeader ? s.containerElevated : null]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={8}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>

        {isDm && secondaryAvatarSeed ? (
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
          <ChannelTopicIconBadge
            iconKey={iconKey}
            size={42}
            iconSize={22}
            borderRadius={21}
            backgroundColor={iconTheme.bg}
            color={iconTheme.fg}
            style={s.iconBox}
          />
        )}

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
              {hasSubtitleMeta && subtitleContent}
            </>
          )}
        </View>

        {!isReadOnly && (
          <View style={s.actions}>
            {liveJoinUrl ? (
              <TouchableOpacity
                style={s.joinPill}
                onPress={handleJoinPress}
                activeOpacity={0.85}
                accessibilityLabel="Join live session"
              >
                <Video size={14} color={colors.teal} />
                <Text style={s.joinPillTxt}>Join</Text>
              </TouchableOpacity>
            ) : onVideo ? (
              <TouchableOpacity style={s.actionBtn} onPress={onVideo} hitSlop={8}>
                <Video size={20} color={colors.text} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={s.actionBtn} onPress={onMore} hitSlop={8}>
              <MoreVertical size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={Boolean(externalJoinTarget)}
        onRequestClose={() => setExternalJoinTarget(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setExternalJoinTarget(null)}>
          <Pressable style={s.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={s.modalHeading}>
              <Text style={s.modalTitle}>Session ready to join</Text>
              <Text style={s.modalDescription}>
                This session opens in an external provider. Stay here until you are ready,
                then use the link below to join.
              </Text>
            </View>
            <View style={s.modalLinkBox}>
              <Text style={s.modalLinkLabel}>Join link</Text>
              <Text style={s.modalLinkValue}>{externalJoinTarget?.joinHref}</Text>
            </View>
            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonSecondary]}
                onPress={() => void handleShareJoinHref()}
                activeOpacity={0.85}
                accessibilityLabel="Share join link"
              >
                <Share2 size={16} color={colors.text} />
                <Text style={s.modalButtonSecondaryText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonPrimary]}
                onPress={() => {
                  if (externalJoinTarget?.joinHref) {
                    handleOpenJoinHref(externalJoinTarget.joinHref);
                  }
                  setExternalJoinTarget(null);
                }}
                activeOpacity={0.85}
                accessibilityLabel={
                  externalJoinTarget?.providerLabel
                    ? `Open ${externalJoinTarget.providerLabel}`
                    : 'Open session'
                }
              >
                <Video size={16} color={colors.tealFg} />
                <Text style={s.modalButtonPrimaryText}>
                  {externalJoinTarget?.providerLabel
                    ? `Join ${externalJoinTarget.providerLabel}`
                    : 'Join session'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalCloseIconButton}
                onPress={() => setExternalJoinTarget(null)}
                activeOpacity={0.85}
                accessibilityLabel="Close join dialog"
              >
                <X size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
