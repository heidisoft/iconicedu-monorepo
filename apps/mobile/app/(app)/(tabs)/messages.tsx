import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpenCheck,
  MessageSquare,
  Presentation,
  ShieldUser,
  User,
  BriefcaseBusiness,
  Sparkles,
} from 'lucide-react-native';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useLearningSpaceChannels } from '@/hooks/use-learning-space-channels';
import {
  useOnlineProfileIds,
  type PresenceDisplayStatus,
} from '@/hooks/use-online-profile-ids';
import { useSupervisedDirectMessages } from '@/hooks/use-supervised-direct-messages';
import { useFamilyView } from '@/providers/family-view-provider';
import { useTheme } from '@/providers/theme-provider';
import { ChannelTopicIconBadge } from '@/lib/learning-space-icons';
import {
  MESSAGE_TITLE_FONT_SIZE,
  MESSAGE_TITLE_FONT_WEIGHT,
} from '@/lib/message-title-typography';
import type { AppColors } from '@/lib/theme';
import { createHeaderSurface } from '@/lib/header-surface';
import {
  archiveChannel,
  fetchChannels,
  markChannelsReadByIds,
  type ChannelListItem,
  type DmParticipant,
} from '@/lib/api/queries';
import { ChannelListSkeleton } from '@/components/skeletons';
import { QueryError } from '@/components/errors/query-error';
import { RoleAvatarBadge } from '@/components/profile/role-avatar-badge';
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import { useIsFocused } from '@react-navigation/native';
import { useMessageDraftPreviews } from '@/hooks/use-message-draft';
import { useHiddenChannels } from '@/hooks/use-hidden-channels';
import { EyeOff, Eye, ChevronDown, ChevronRight, Archive } from 'lucide-react-native';

import { AvatarImage } from '@/components/profile/avatar-image';
type Tab = 'all' | 'dms' | 'channels';
type ClassroomStudentTab = 'all' | string;

type SectionHeaderItem = { _type: 'section-header'; title: string; id: string };
type HiddenSectionToggle = { _type: 'hidden-section-toggle'; count: number; id: string };
type ListRow = ChannelListItem | SectionHeaderItem | HiddenSectionToggle;

const CLASS_REQUEST_CHANNEL_PURPOSE = 'chass-requests';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatListTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitials(name: string | null): string {
  const t = (name ?? '?').trim();
  const words = t.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return t[0]?.toUpperCase() ?? '?';
}

function participantName(p: DmParticipant): string {
  return (
    p.display_name?.trim() ||
    [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
    'Unknown'
  );
}

function getDmPresenceProfileId(item: ChannelListItem): string | null {
  const participantId = item.participants?.[0]?.id?.trim();
  return participantId || null;
}

const THEME_TEXT_COLORS: Record<string, string> = {
  slate: '#667487',
  gray: '#6e737a',
  zinc: '#73737a',
  neutral: '#75726e',
  stone: '#7c756b',
  red: '#cc5b52',
  orange: '#cf7a4e',
  amber: '#c08a3e',
  yellow: '#b09a44',
  lime: '#86a049',
  green: '#4f9d62',
  emerald: '#3a9375',
  teal: '#3f978f',
  cyan: '#43919e',
  sky: '#5090bb',
  blue: '#547fb4',
  indigo: '#6266a8',
  violet: '#7a6aac',
  purple: '#8767a6',
  fuchsia: '#a5629a',
  pink: '#bd6a8c',
  rose: '#c56370',
};

const THEME_AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  slate: { bg: '#667487', fg: '#ffffff' },
  gray: { bg: '#6e737a', fg: '#ffffff' },
  zinc: { bg: '#73737a', fg: '#ffffff' },
  neutral: { bg: '#75726e', fg: '#ffffff' },
  stone: { bg: '#7c756b', fg: '#ffffff' },
  red: { bg: '#cc5b52', fg: '#ffffff' },
  orange: { bg: '#cf7a4e', fg: '#1f2a26' },
  amber: { bg: '#c08a3e', fg: '#1f2a26' },
  yellow: { bg: '#b09a44', fg: '#1f2a26' },
  lime: { bg: '#86a049', fg: '#1f2a26' },
  green: { bg: '#4f9d62', fg: '#ffffff' },
  emerald: { bg: '#3a9375', fg: '#ffffff' },
  teal: { bg: '#3f978f', fg: '#ffffff' },
  cyan: { bg: '#43919e', fg: '#ffffff' },
  sky: { bg: '#5090bb', fg: '#ffffff' },
  blue: { bg: '#547fb4', fg: '#ffffff' },
  indigo: { bg: '#6266a8', fg: '#ffffff' },
  violet: { bg: '#7a6aac', fg: '#ffffff' },
  purple: { bg: '#8767a6', fg: '#ffffff' },
  fuchsia: { bg: '#a5629a', fg: '#ffffff' },
  pink: { bg: '#bd6a8c', fg: '#ffffff' },
  rose: { bg: '#c56370', fg: '#ffffff' },
};

function themeTextColor(themeKey?: string | null, fallback?: string): string {
  return (themeKey && THEME_TEXT_COLORS[themeKey]) || fallback || '#6b7469';
}

function themeAvatarColor(
  themeKey?: string | null,
  fallbackBg?: string,
  fallbackFg?: string,
): { bg: string; fg: string } {
  return (
    (themeKey && THEME_AVATAR_COLORS[themeKey]) || {
      bg: fallbackBg || '#eef0ea',
      fg: fallbackFg || '#1f2a26',
    }
  );
}

function normalizeDisplayName(name?: string | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildChannelStudentTitle(input: {
  channelTitle: string;
  studentProfiles: Array<{ name: string; themeKey?: string | null }>;
  currentProfileName?: string | null;
  currentProfileKind?: string | null;
}) {
  const currentProfileName = normalizeDisplayName(input.currentProfileName);
  const visibleStudents = input.studentProfiles.filter((student) => {
    const studentName = normalizeDisplayName(student.name);
    if (!studentName) return false;
    if (input.currentProfileKind === 'child' && studentName === currentProfileName) {
      return false;
    }
    return true;
  });

  const leadStudent = visibleStudents[0] ?? null;
  const remainingCount = Math.max(0, visibleStudents.length - 1);

  return {
    leadStudent,
    remainingCount,
    hasVisibleStudents: visibleStudents.length > 0,
    channelTitle: input.channelTitle,
  };
}

type ClassroomParticipantProfile = {
  name: string;
  kind: 'educator' | 'guardian' | 'child' | 'staff' | 'system';
  themeKey?: string | null;
};

const CLASSROOM_PARTICIPANT_GROUP_ORDER: ClassroomParticipantProfile['kind'][] = [
  'educator',
  'guardian',
  'child',
  'staff',
  'system',
];

const CLASSROOM_PARTICIPANT_ICON_MAP: Record<
  ClassroomParticipantProfile['kind'],
  typeof Presentation
> = {
  educator: Presentation,
  guardian: ShieldUser,
  child: User,
  staff: BriefcaseBusiness,
  system: Sparkles,
};

function buildVisibleClassroomParticipantGroups(input: {
  participantProfiles: ClassroomParticipantProfile[];
  currentProfileName?: string | null;
  currentProfileKind?: string | null;
}) {
  const currentProfileName = normalizeDisplayName(input.currentProfileName);
  const visibleParticipants = input.participantProfiles.filter((participant) => {
    const participantName = normalizeDisplayName(participant.name);
    if (!participantName) return false;
    if (
      input.currentProfileKind === participant.kind &&
      participantName === currentProfileName
    ) {
      return false;
    }
    return true;
  });

  return CLASSROOM_PARTICIPANT_GROUP_ORDER.map((kind) => ({
    kind,
    participants: visibleParticipants.filter((participant) => participant.kind === kind),
  })).filter((group) => group.participants.length > 0);
}

function buildFallbackParticipantProfilesFromStudents(
  studentProfiles: Array<{ name: string; themeKey?: string | null }>,
): ClassroomParticipantProfile[] {
  return studentProfiles
    .filter((student) => student.name.trim().length > 0)
    .map((student) => ({
      name: student.name,
      kind: 'child' as const,
      themeKey: student.themeKey ?? null,
    }));
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
      ...createHeaderSurface(C.bg, C.border),
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: 0 },
    headerAction: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: C.inputBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    headerActionDisabled: {
      opacity: 0.45,
    },
    headerActionText: {
      fontSize: 13,
      fontWeight: '700',
      color: C.teal,
    },

    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1,
    },
    tabActive: { borderBottomColor: C.teal },
    tabInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tabText: { fontSize: 14, fontWeight: '600', color: C.textFaint },
    tabTextActive: { color: C.teal },
    tabBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: C.red,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
    subTabScroll: { maxHeight: 44 },
    subTabContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    subTab: {
      minHeight: 32,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subTabActive: {
      backgroundColor: C.tealBg,
      borderColor: C.teal,
    },
    subTabText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
    subTabTextActive: { color: C.teal },

    listContent: {
      paddingTop: 14,
      paddingBottom: 16,
    },
    itemOuter: {
      marginHorizontal: 0,
      marginBottom: 0,
    },
    itemWrap: {
      position: 'relative',
      backgroundColor: C.bg,
      paddingHorizontal: 16,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    itemWrapUnread: {},
    itemRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12 },
    separator: {
      height: 8,
      justifyContent: 'center',
    },
    separatorLine: {
      marginLeft: 78,
      marginRight: 16,
      height: StyleSheet.hairlineWidth,
    },

    // ── DM avatar — single person ──────────────────────────────────────────────
    avatarWrap: { position: 'relative', width: 50, height: 50, flexShrink: 0 },
    avatarCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 18, letterSpacing: 0 },
    onlineDot: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: C.success,
      borderWidth: 2,
      borderColor: C.bg,
    },
    statusBadge: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.bg,
    },
    statusBadgeAway: { backgroundColor: C.warning },
    statusBadgeBusy: { backgroundColor: C.red },
    statusBadgeOffline: { backgroundColor: C.textMuted },

    // ── DM avatar — group (stacked) ────────────────────────────────────────────
    groupWrap: { width: 50, height: 50, flexShrink: 0, position: 'relative' },
    groupBack: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.bg,
    },
    groupFront: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.bg,
    },
    groupTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
    groupBadgeFront: {},
    groupBadgeBack: {},

    // ── Class avatar ──────────────────────────────────────────────────
    channelAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderWidth: 0,
    },
    channelEmoji: { fontSize: 25 },

    content: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 3 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowNameWrap: { flex: 1, minWidth: 0 },
    rowName: {
      fontSize: MESSAGE_TITLE_FONT_SIZE,
      fontWeight: MESSAGE_TITLE_FONT_WEIGHT,
      color: C.text,
    },
    rowNameUnread: { fontWeight: '800' },
    rowNameStudentNames: { fontWeight: '600' },
    rowTail: {
      width: 58,
      alignItems: 'flex-end',
      justifyContent: 'center',
      flexShrink: 0,
      alignSelf: 'stretch',
      paddingVertical: 2,
    },
    rowTime: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
    rowMeta: { fontSize: 13, color: C.textMuted, lineHeight: 17 },
    rowMetaName: { fontWeight: '600' },
    rowMetaWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      minWidth: 0,
    },
    rowMetaGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 0,
    },
    rowMetaGroupNames: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      minWidth: 0,
    },
    rowPreview: { fontSize: 14, color: C.textMuted, lineHeight: 18 },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeTxt: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    // Shown when the user explicitly marked a conversation unread but there are
    // no actual unread messages to count.
    badgeDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: C.teal,
    },

    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingBottom: 60,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontSize: 20, fontWeight: '700' },
    emptyDesc: {
      fontSize: 15,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
    },

    // ── Supervised badge ───────────────────────────────────────────────────────
    supervisedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: C.tealBg,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.teal,
    },
    supervisedBadgeTxt: { fontSize: 11, fontWeight: '700', color: C.teal },

    // ── Section header ─────────────────────────────────────────────────────────
    sectionHeaderWrap: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 7 },
    sectionHeaderTxt: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },

    // ── Swipe actions ──────────────────────────────────────────────────────────
    swipeActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      gap: 8,
    },
    swipeBtn: {
      alignItems: 'center',
      gap: 4,
      width: 56,
    },
    swipeBtnCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swipeBtnHide: { backgroundColor: '#5090bb' },
    swipeBtnUnhide: { backgroundColor: '#5090bb' },
    swipeBtnArchive: { backgroundColor: '#cc5b52' },
    swipeBtnLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: C.textMuted,
    },

    // ── Hidden channels section ────────────────────────────────────────────────
    hiddenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 8,
    },
    hiddenHeaderTxt: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: C.textMuted,
    },
    hiddenHeaderCount: {
      fontSize: 12,
      fontWeight: '600',
      color: C.textFaint,
    },
  });
}

function PresenceBadge({
  status,
  s,
}: {
  status?: PresenceDisplayStatus | null;
  s: ReturnType<typeof makeStyles>;
}) {
  if (!status) return null;

  if (status === 'online') {
    return <View style={s.onlineDot} />;
  }

  if (status === 'away' || status === 'idle') {
    return <View style={[s.statusBadge, s.statusBadgeAway]} />;
  }

  if (status === 'busy') {
    return <View style={[s.statusBadge, s.statusBadgeBusy]} />;
  }

  return <View style={[s.statusBadge, s.statusBadgeOffline]} />;
}

// ─── DM avatar ────────────────────────────────────────────────────────────────

function DmAvatar({
  participants,
  fallbackId,
  presenceStatus,
  s,
}: {
  participants: DmParticipant[];
  fallbackId: string;
  presenceStatus: PresenceDisplayStatus | null;
  s: ReturnType<typeof makeStyles>;
}) {
  const isGroup = participants.length > 1;

  if (isGroup) {
    const [back, front] = participants;
    return (
      <View style={s.groupWrap}>
        {back!.avatar_url ? (
          <AvatarImage
            uri={back!.avatar_url}
            style={s.groupBack}
            accessibilityLabel={participantName(back!)}
          />
        ) : (
          <View
            style={[
              s.groupBack,
              {
                backgroundColor: profileAvatarColors({
                  seed: back!.avatar_seed ?? back!.id,
                  themeKey: back!.ui_theme_key,
                }).bg,
              },
            ]}
          >
            <Text
              style={[
                s.groupTxt,
                {
                  color: profileAvatarColors({
                    seed: back!.avatar_seed ?? back!.id,
                    themeKey: back!.ui_theme_key,
                  }).fg,
                },
              ]}
            >
              {getInitials(participantName(back!))}
            </Text>
          </View>
        )}
        <RoleAvatarBadge role={back?.kind} size={14} style={s.groupBadgeBack} />
        {front!.avatar_url ? (
          <AvatarImage
            uri={front!.avatar_url}
            style={s.groupFront}
            accessibilityLabel={participantName(front!)}
          />
        ) : (
          <View
            style={[
              s.groupFront,
              {
                backgroundColor: profileAvatarColors({
                  seed: front!.avatar_seed ?? front!.id,
                  themeKey: front!.ui_theme_key,
                }).bg,
              },
            ]}
          >
            <Text
              style={[
                s.groupTxt,
                {
                  color: profileAvatarColors({
                    seed: front!.avatar_seed ?? front!.id,
                    themeKey: front!.ui_theme_key,
                  }).fg,
                },
              ]}
            >
              {getInitials(participantName(front!))}
            </Text>
          </View>
        )}
        <RoleAvatarBadge role={front?.kind} size={14} style={s.groupBadgeFront} />
        <PresenceBadge status={presenceStatus ?? 'offline'} s={s} />
      </View>
    );
  }

  const person = participants[0];
  const name = person ? participantName(person) : null;
  const avatarColors = profileAvatarColors({
    seed: person?.avatar_seed ?? person?.id ?? fallbackId,
    themeKey: person?.ui_theme_key,
  });

  return (
    <View style={s.avatarWrap}>
      {person?.avatar_url ? (
        <AvatarImage
          uri={person.avatar_url}
          style={s.avatarCircle}
          accessibilityLabel={name ?? undefined}
        />
      ) : (
        <View style={[s.avatarCircle, { backgroundColor: avatarColors.bg }]}>
          <Text style={[s.avatarTxt, { color: avatarColors.fg }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}
      <PresenceBadge status={presenceStatus ?? 'offline'} s={s} />
      <RoleAvatarBadge role={person?.kind} size={16} />
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  s,
}: {
  title: string;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.sectionHeaderWrap}>
      <Text style={s.sectionHeaderTxt}>{title}</Text>
    </View>
  );
}

// ─── Swipe action buttons ─────────────────────────────────────────────────────

function SwipeActions({
  progress,
  isHidden,
  onHide,
  onUnhide,
  onArchive,
  s,
}: {
  progress: SharedValue<number>;
  isHidden: boolean;
  onHide?: () => void;
  onUnhide?: () => void;
  onArchive?: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  const btn1Style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.4, 1], Extrapolation.CLAMP) },
      { translateX: interpolate(progress.value, [0, 1], [24, 0], Extrapolation.CLAMP) },
    ],
  }));

  const btn2Style = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.25, 0.65, 1],
      [0, 0.6, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      { scale: interpolate(progress.value, [0.25, 1], [0.4, 1], Extrapolation.CLAMP) },
      { translateX: interpolate(progress.value, [0, 1], [24, 0], Extrapolation.CLAMP) },
    ],
  }));

  // 12px padding each side + 56px per button + 8px gap.
  const panelWidth = onArchive ? 144 : 80;

  return (
    <View style={[s.swipeActionsRow, { width: panelWidth }]}>
      <Animated.View style={[s.swipeBtn, btn1Style]}>
        <TouchableOpacity
          style={[s.swipeBtnCircle, isHidden ? s.swipeBtnUnhide : s.swipeBtnHide]}
          onPress={isHidden ? onUnhide : onHide}
          activeOpacity={0.75}
        >
          {isHidden ? (
            <Eye size={20} color="#ffffff" />
          ) : (
            <EyeOff size={20} color="#ffffff" />
          )}
        </TouchableOpacity>
        <Text style={s.swipeBtnLabel}>{isHidden ? 'Show' : 'Hide'}</Text>
      </Animated.View>

      {!!onArchive && (
        <Animated.View style={[s.swipeBtn, btn2Style]}>
          <TouchableOpacity
            style={[s.swipeBtnCircle, s.swipeBtnArchive]}
            onPress={onArchive}
            activeOpacity={0.75}
          >
            <Archive size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={s.swipeBtnLabel}>Archive</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

function ChannelRow({
  item,
  onPress,
  onHide,
  onUnhide,
  onArchive,
  isHidden = false,
  presenceByProfileId,
  currentProfileName,
  currentProfileKind,
  draftText,
  onSwipeWillOpen,
  s,
  colors,
}: {
  item: ChannelListItem;
  onPress: () => void;
  onSwipeWillOpen?: (swipeable: SwipeableMethods | null) => void;
  onHide?: () => void;
  onUnhide?: () => void;
  onArchive?: () => void;
  isHidden?: boolean;
  presenceByProfileId: Map<string, PresenceDisplayStatus>;
  currentProfileName?: string | null;
  currentProfileKind?: string | null;
  /** Unsent main-composer draft for this channel; replaces the last-message preview. */
  draftText?: string | null;
  s: ReturnType<typeof makeStyles>;
  colors: AppColors;
}) {
  const isDm = item.kind === 'dm';
  const participants = item.participants ?? [];

  // For supervised DMs, show both names and inject a synthetic child participant for the avatar
  const supervisedChildName = item.is_supervised
    ? (item.supervised_child_name ?? 'Child')
    : null;
  const partnerName =
    participants.length > 0
      ? participantName(participants[0]!)
      : (item.topic ?? 'Unknown');

  const name = isDm
    ? supervisedChildName
      ? `${supervisedChildName} <> ${partnerName}`
      : participants.length > 0
        ? participants.map(participantName).join(', ')
        : (item.topic ?? 'Direct Message')
    : (item.topic ?? 'Channel');
  const displayRole =
    isDm && participants.some((participant) => participant.kind === 'staff')
      ? 'staff'
      : null;

  // For supervised DMs, build a two-person participant list: child first, then partner
  const avatarParticipants: DmParticipant[] =
    isDm && supervisedChildName
      ? [
          {
            id: supervisedChildName,
            display_name: supervisedChildName,
            first_name: null,
            last_name: null,
            avatar_url: null,
            avatar_seed: null,
            kind: 'child',
          },
          ...(participants.length > 0 ? [participants[0]!] : []),
        ]
      : participants;
  const presenceProfileId = isDm ? getDmPresenceProfileId(item) : null;
  const presenceStatus = isDm
    ? (presenceByProfileId.get(presenceProfileId ?? '') ?? 'offline')
    : null;

  const text = item.last_message_text;
  const sender = item.last_message_sender;
  const isMine = item.last_message_is_mine === true;
  const time = formatListTime(item.last_message_at ?? item.updated_at);
  const unread = (item.unread_count ?? 0) + (item.thread_unread_count ?? 0);
  // An explicit "mark unread" keeps the row in its unread treatment even when
  // there is nothing left to count.
  const isManuallyUnread = item.is_manually_unread === true;
  const hasUnread = unread > 0 || isManuallyUnread;
  const isClassroom = !isDm && Boolean(item.is_learning_space);
  const studentProfiles = !isDm ? (item.student_profiles ?? []) : [];
  const participantProfiles = !isDm ? (item.participant_profiles ?? []) : [];
  const classThemeKey = !isDm ? (item.themeKey ?? null) : null;
  const classAvatarColors = themeAvatarColor(classThemeKey, colors.inputBg, colors.text);
  const classroomParticipantSource =
    participantProfiles.length > 0
      ? participantProfiles
      : buildFallbackParticipantProfilesFromStudents(studentProfiles);
  const classroomParticipantGroups = buildVisibleClassroomParticipantGroups({
    participantProfiles: classroomParticipantSource,
    currentProfileName,
    currentProfileKind,
  });
  const hasClassroomMeta = !isDm && classroomParticipantGroups.length > 0;
  const channelStudentTitle = buildChannelStudentTitle({
    channelTitle: name,
    studentProfiles,
    currentProfileName,
    currentProfileKind,
  });
  const messagePreviewText = text
    ? isMine
      ? `You: ${text}`
      : !isDm && sender
        ? `${sender}: ${text}`
        : text
    : '';
  const previewText =
    item.is_supervised && item.supervised_child_name
      ? `Viewing ${item.supervised_child_name}'s conversation`
      : messagePreviewText || (isClassroom ? '' : (item.description ?? ''));
  const previewLines = isClassroom ? 1 : 2;
  const draftPreview = draftText?.replace(/\s+/g, ' ').trim() || null;

  const rightActions = useCallback(
    (progress: SharedValue<number>) => (
      <SwipeActions
        progress={progress}
        isHidden={isHidden}
        onHide={onHide}
        onUnhide={onUnhide}
        onArchive={onArchive}
        s={s}
      />
    ),
    [isHidden, onHide, onUnhide, onArchive, s],
  );
  const swipeRef = useRef<SwipeableMethods>(null);

  return (
    <View style={s.itemOuter}>
      <ReanimatedSwipeable
        ref={swipeRef}
        renderRightActions={rightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
        onSwipeableWillOpen={() => onSwipeWillOpen?.(swipeRef.current)}
      >
        <Pressable onPress={onPress}>
          {({ pressed }) => (
            <View
              style={[
                s.itemWrap,
                hasUnread && s.itemWrapUnread,
                pressed && { backgroundColor: colors.inputBg },
              ]}
            >
              <View style={s.itemRow}>
                {/* Avatar */}
                {isDm ? (
                  <DmAvatar
                    participants={avatarParticipants}
                    fallbackId={item.id}
                    presenceStatus={presenceStatus}
                    s={s}
                  />
                ) : (
                  <ChannelTopicIconBadge
                    iconKey={item.icon_key}
                    size={50}
                    iconSize={22}
                    borderRadius={25}
                    backgroundColor={classAvatarColors.bg}
                    color={classAvatarColors.fg}
                    style={s.channelAvatar}
                  />
                )}

                {/* Content */}
                <View style={s.content}>
                  <View style={s.topRow}>
                    {isDm ? (
                      <RoleNameIndicator
                        name={name}
                        role={displayRole}
                        containerStyle={s.rowNameWrap}
                        textStyle={[s.rowName, hasUnread && s.rowNameUnread]}
                        numberOfLines={1}
                        iconSize={13}
                      />
                    ) : (
                      <View style={s.rowNameWrap}>
                        <Text
                          style={[s.rowName, hasUnread && s.rowNameUnread]}
                          numberOfLines={1}
                        >
                          {channelStudentTitle.channelTitle}
                        </Text>
                      </View>
                    )}
                    {item.is_supervised && (
                      <View style={s.supervisedBadge}>
                        <Text style={s.supervisedBadgeTxt}>Supervised</Text>
                      </View>
                    )}
                  </View>
                  {!isDm && hasClassroomMeta ? (
                    <View style={s.rowMetaWrap}>
                      {classroomParticipantGroups.map((group) => {
                        const GroupIcon = CLASSROOM_PARTICIPANT_ICON_MAP[group.kind];

                        return (
                          <View key={group.kind} style={s.rowMetaGroup}>
                            <GroupIcon
                              size={12}
                              color={colors.textMuted}
                              strokeWidth={2}
                            />
                            <View style={s.rowMetaGroupNames}>
                              {group.participants.map((participant, index) => (
                                <React.Fragment
                                  key={`${participant.kind}-${participant.name}`}
                                >
                                  {index > 0 ? (
                                    <Text style={s.rowMeta}>{', '}</Text>
                                  ) : null}
                                  <Text
                                    style={[
                                      s.rowMeta,
                                      s.rowMetaName,
                                      participant.kind === 'child'
                                        ? {
                                            color: themeTextColor(
                                              participant.themeKey,
                                              colors.textMuted,
                                            ),
                                          }
                                        : null,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {participant.name}
                                  </Text>
                                </React.Fragment>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                  {draftPreview ? (
                    <Text style={s.rowPreview} numberOfLines={previewLines}>
                      {`Draft: ${draftPreview}`}
                    </Text>
                  ) : previewText ? (
                    <Text style={s.rowPreview} numberOfLines={previewLines}>
                      {previewText}
                    </Text>
                  ) : null}
                </View>
                <View style={s.rowTail}>
                  <Text style={s.rowTime} numberOfLines={1}>
                    {time}
                  </Text>
                  {hasUnread ? (
                    unread > 0 ? (
                      <View style={s.badge}>
                        <Text style={s.badgeTxt}>{unread > 99 ? '99+' : unread}</Text>
                      </View>
                    ) : (
                      <View testID="channel-row-manual-unread-dot" style={s.badgeDot} />
                    )
                  ) : (
                    <View />
                  )}
                </View>
              </View>
            </View>
          )}
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const resolvedTab: Tab =
    tabParam === 'channels' || tabParam === 'dms' ? tabParam : 'all';
  const [activeTab, setActiveTab] = useState<Tab>(resolvedTab);
  const [activeStudentTab, setActiveStudentTab] = useState<ClassroomStudentTab>('all');

  React.useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  const {
    data: account,
    isPending: accountLoading,
    isError: accountError,
  } = useAccount();
  const { data: profile } = useProfile();
  const { guardianAccountId, guardianProfileId } = useFamilyView();
  const { colors } = useTheme();
  const router = useRouter();
  const isFocused = useIsFocused();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const myProfileId =
    ((profile as Record<string, unknown> | undefined)?.id as string | undefined) ?? '';
  const { drafts: draftsByChannelId, refresh: refreshDrafts } = useMessageDraftPreviews(
    { accountId, profileId: myProfileId, orgId },
    true,
  );
  const { hiddenChannelIds, hideChannel, unhideChannel } = useHiddenChannels(myProfileId);
  const [hiddenSectionExpanded, setHiddenSectionExpanded] = useState(false);
  const openSwipeRef = useRef<SwipeableMethods | null>(null);
  const handleSwipeWillOpen = useCallback((swipeable: SwipeableMethods | null) => {
    if (openSwipeRef.current && openSwipeRef.current !== swipeable) {
      openSwipeRef.current.close();
    }
    openSwipeRef.current = swipeable;
  }, []);
  const closeOpenSwipe = useCallback(() => {
    openSwipeRef.current?.close();
    openSwipeRef.current = null;
  }, []);
  // Re-read AsyncStorage whenever this tab regains focus — a draft saved on
  // the channel/DM screen should show up here as soon as the user backs out.
  React.useEffect(() => {
    if (isFocused) {
      void refreshDrafts();
    }
  }, [isFocused, refreshDrafts]);
  const currentProfileName =
    (
      (profile as Record<string, unknown> | undefined)?.display_name as string | undefined
    )?.trim() ||
    [
      (profile as Record<string, unknown> | undefined)?.first_name as string | undefined,
      (profile as Record<string, unknown> | undefined)?.last_name as string | undefined,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    null;
  const profileKind =
    ((profile as Record<string, unknown> | undefined)?.kind as string | undefined) ??
    null;
  const isParentView = profileKind === 'guardian';

  const {
    data: dms,
    isPending: dmsLoading,
    isError: dmsError,
    refetch: refetchDms,
  } = useDirectMessages(orgId, myProfileId, accountId);
  const {
    data: channels,
    isPending: channelsLoading,
    isError: channelsError,
    refetch: refetchChannels,
  } = useLearningSpaceChannels(orgId, myProfileId, accountId, profileKind);
  const {
    data: listedChannels,
    isPending: listedChannelsLoading,
    isError: listedChannelsError,
    refetch: refetchListedChannels,
  } = useQuery({
    queryKey: ['messageListedChannels', orgId, accountId] as const,
    queryFn: () => fetchChannels(orgId, accountId),
    enabled: !!orgId && !!accountId,
  });
  const {
    data: supervisedDms,
    isLoading: supervisedLoading,
    refetch: refetchSupervised,
  } = useSupervisedDirectMessages(orgId, guardianAccountId, guardianProfileId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchDms(),
      refetchChannels(),
      refetchListedChannels(),
      refetchSupervised(),
      refreshDrafts(),
    ]);
    setRefreshing(false);
  }, [
    refetchDms,
    refetchChannels,
    refetchListedChannels,
    refetchSupervised,
    refreshDrafts,
  ]);

  const allDms = useMemo(() => dms ?? [], [dms]);
  const allChannels = useMemo(() => channels ?? [], [channels]);
  const classRequestChannels = useMemo(() => {
    const existingChannelIds = new Set(allChannels.map((channel) => channel.id));
    return (listedChannels ?? []).filter(
      (channel) =>
        channel.purpose === CLASS_REQUEST_CHANNEL_PURPOSE &&
        !existingChannelIds.has(channel.id),
    );
  }, [allChannels, listedChannels]);
  const allMessageChannels = useMemo(
    () => [...allChannels, ...classRequestChannels],
    [allChannels, classRequestChannels],
  );
  const classroomChannels = useMemo(
    () => allChannels.filter((channel) => channel.is_learning_space),
    [allChannels],
  );
  const classroomStudentTabs = useMemo(() => {
    const seen = new Set<string>();
    const tabs: Array<{
      key: ClassroomStudentTab;
      label: string;
      themeKey?: string | null;
    }> = [{ key: 'all', label: 'All' }];

    for (const channel of classroomChannels) {
      for (const student of channel.student_profiles ?? []) {
        const name = student.name.trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        tabs.push({ key: name, label: name, themeKey: student.themeKey ?? null });
      }
    }

    return tabs;
  }, [classroomChannels]);
  const hasClassroomStudentTabs = classroomStudentTabs.length > 2;
  const allSupervisedDms = useMemo(() => supervisedDms ?? [], [supervisedDms]);
  const dmParticipantIds = useMemo(
    () =>
      [...allDms, ...allSupervisedDms].flatMap((channel) =>
        (channel.participants ?? []).map((participant) => participant.id),
      ),
    [allDms, allSupervisedDms],
  );
  const presenceByProfileId = useOnlineProfileIds(orgId, myProfileId, dmParticipantIds);

  React.useEffect(() => {
    if (activeTab !== 'channels' || !isParentView) {
      setActiveStudentTab('all');
      return;
    }

    if (
      activeStudentTab !== 'all' &&
      !classroomStudentTabs.some((tab) => tab.key === activeStudentTab)
    ) {
      setActiveStudentTab('all');
    }
  }, [activeStudentTab, activeTab, classroomStudentTabs, isParentView]);

  const allItems = useMemo(
    () =>
      [...allDms, ...allSupervisedDms, ...allMessageChannels].sort((a, b) => {
        const ta = a.last_message_at ?? a.updated_at ?? '';
        const tb = b.last_message_at ?? b.updated_at ?? '';
        return tb.localeCompare(ta);
      }),
    [allDms, allSupervisedDms, allMessageChannels],
  );

  // DMs tab: regular DMs followed by a "Supervised Inboxes" section when applicable
  const dmsData = useMemo(
    (): ListRow[] => [
      ...allDms,
      ...(allSupervisedDms.length > 0
        ? [
            {
              _type: 'section-header' as const,
              title: 'Supervised Inboxes',
              id: '__supervised-header__',
            },
            ...allSupervisedDms,
          ]
        : []),
    ],
    [allDms, allSupervisedDms],
  );
  const filteredClassroomChannels = useMemo(
    () =>
      activeStudentTab === 'all'
        ? classroomChannels
        : classroomChannels.filter((channel) =>
            (channel.student_profiles ?? []).some(
              (student) => student.name === activeStudentTab,
            ),
          ),
    [activeStudentTab, classroomChannels],
  );

  const rawData: ListRow[] =
    activeTab === 'all'
      ? allItems
      : activeTab === 'dms'
        ? dmsData
        : filteredClassroomChannels;

  const { visibleData, hiddenItems } = useMemo(() => {
    const visible: ListRow[] = [];
    const hidden: ChannelListItem[] = [];
    for (const row of rawData) {
      if ('_type' in row) {
        visible.push(row);
      } else if (hiddenChannelIds.has(row.id)) {
        hidden.push(row);
      } else {
        visible.push(row);
      }
    }
    return { visibleData: visible, hiddenItems: hidden };
  }, [rawData, hiddenChannelIds]);

  const data: ListRow[] = useMemo(() => {
    if (hiddenItems.length === 0) return visibleData;
    const toggle: HiddenSectionToggle = {
      _type: 'hidden-section-toggle',
      count: hiddenItems.length,
      id: '__hidden-toggle__',
    };
    if (hiddenSectionExpanded) {
      return [toggle, ...hiddenItems, ...visibleData];
    }
    return [toggle, ...visibleData];
  }, [visibleData, hiddenItems, hiddenSectionExpanded]);

  const unreadAll = useMemo(
    () =>
      allItems.reduce(
        (n, i) => n + (i.unread_count ?? 0) + (i.thread_unread_count ?? 0),
        0,
      ),
    [allItems],
  );
  const unreadDms = useMemo(
    () =>
      [...allDms, ...allSupervisedDms].reduce(
        (n, i) => n + (i.unread_count ?? 0) + (i.thread_unread_count ?? 0),
        0,
      ),
    [allDms, allSupervisedDms],
  );
  const unreadChannels = useMemo(
    () =>
      classroomChannels.reduce(
        (n, i) => n + (i.unread_count ?? 0) + (i.thread_unread_count ?? 0),
        0,
      ),
    [classroomChannels],
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: unreadAll },
    { key: 'dms', label: 'Direct Messages', count: unreadDms },
    { key: 'channels', label: 'Classrooms', count: unreadChannels },
  ];

  const isLoading =
    !accountError &&
    (accountLoading ||
      dmsLoading ||
      channelsLoading ||
      listedChannelsLoading ||
      supervisedLoading);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const visibleUnreadChannelIds = useMemo(
    () =>
      data
        .filter((item): item is ChannelListItem => !('_type' in item))
        .filter(
          (item) =>
            (item.unread_count ?? 0) + (item.thread_unread_count ?? 0) > 0 ||
            item.is_manually_unread === true,
        )
        .map((item) => item.id),
    [data],
  );
  const hasVisibleUnread = visibleUnreadChannelIds.length > 0;

  const handleMarkAllRead = useCallback(() => {
    if (!orgId || !accountId || !myProfileId || !hasVisibleUnread || markingAllRead) {
      return;
    }

    Alert.alert(
      'Mark all as read',
      'Mark all visible conversations as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark all read',
          onPress: async () => {
            try {
              setMarkingAllRead(true);
              await markChannelsReadByIds({
                orgId,
                accountId,
                profileId: myProfileId,
                channelIds: visibleUnreadChannelIds,
              });
              await Promise.all([
                refetchDms(),
                refetchChannels(),
                refetchListedChannels(),
                refetchSupervised(),
              ]);
            } finally {
              setMarkingAllRead(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [
    accountId,
    hasVisibleUnread,
    markingAllRead,
    myProfileId,
    orgId,
    refetchChannels,
    refetchDms,
    refetchListedChannels,
    refetchSupervised,
    visibleUnreadChannelIds,
  ]);

  const emptyConfig = {
    all: {
      icon: MessageSquare,
      title: 'No messages yet',
      desc: 'Your conversations will appear here',
    },
    dms: {
      icon: MessageSquare,
      title: 'No direct messages',
      desc: 'Start a conversation with a tutor or educator',
    },
    channels: {
      icon: BookOpenCheck,
      title: 'No classes',
      desc: 'Channels you join will appear here',
    },
  }[activeTab];

  const isEmpty =
    visibleData.length === 0 || (visibleData.length === 1 && '_type' in visibleData[0]!);
  const isStaffOrAdmin = profileKind === 'staff';

  const renderItem = useCallback(
    ({ item }: { item: ListRow }) => {
      if ('_type' in item && item._type === 'section-header') {
        return <SectionHeader title={item.title} s={s} />;
      }
      if ('_type' in item && item._type === 'hidden-section-toggle') {
        return (
          <TouchableOpacity
            style={s.hiddenHeader}
            onPress={() => setHiddenSectionExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            {hiddenSectionExpanded ? (
              <ChevronDown size={16} color={colors.textMuted} />
            ) : (
              <ChevronRight size={16} color={colors.textMuted} />
            )}
            <Text style={s.hiddenHeaderTxt}>Hidden</Text>
            <Text style={s.hiddenHeaderCount}>{item.count}</Text>
          </TouchableOpacity>
        );
      }
      const channel = item as ChannelListItem;
      const isHidden = hiddenChannelIds.has(channel.id);
      const isDm = channel.kind === 'dm';
      const participants = channel.participants ?? [];
      // For supervised DMs, topic = the partner's name (child is excluded from participants).
      // The DM screen will build "ChildName <> PartnerName" from these two values.
      const partnerTitle =
        participants.length > 0
          ? participants.map(participantName).join(', ')
          : (channel.topic ?? 'Direct Message');
      const displayTitle = isDm ? partnerTitle : (channel.topic ?? 'Channel');
      const avatarSeed = isDm
        ? (participants[0]?.avatar_seed ?? participants[0]?.id ?? '')
        : '';
      const presenceProfileId = isDm ? getDmPresenceProfileId(channel) : '';
      const avatarUrl = isDm ? (participants[0]?.avatar_url ?? '') : '';
      const avatarRole = isDm ? (participants[0]?.kind ?? '') : '';
      const avatarThemeKey = isDm ? (participants[0]?.ui_theme_key ?? '') : '';
      const avatarTimezone = isDm ? (participants[0]?.timezone ?? '') : '';
      const avatarCity = isDm ? (participants[0]?.city ?? '') : '';
      const avatarCountryCode = isDm ? (participants[0]?.country_code ?? '') : '';
      const avatarCountryName = isDm ? (participants[0]?.country_name ?? '') : '';
      const iconKey = !isDm ? (channel.icon_key ?? '') : '';
      const themeKey = !isDm ? (channel.themeKey ?? '') : '';
      const messageUiThemeKey = isDm ? 'classic' : (channel.messageUiThemeKey ?? 'feed');
      const subtitle = isDm ? 'Direct Message' : (channel.description ?? '');
      const studentProfiles = !isDm ? JSON.stringify(channel.student_profiles ?? []) : '';
      const participantProfiles = !isDm
        ? JSON.stringify(channel.participant_profiles ?? [])
        : '';
      const isLearningSpace = !isDm && channel.is_learning_space ? '1' : '0';
      const pathname = isDm
        ? '/(app)/dm/[channelId]'
        : isLearningSpace === '1'
          ? '/(app)/spaces/[channelId]'
          : '/(app)/channel/[channelId]';
      return (
        <ChannelRow
          item={channel}
          isHidden={isHidden}
          presenceByProfileId={presenceByProfileId}
          currentProfileName={currentProfileName}
          currentProfileKind={profileKind}
          draftText={draftsByChannelId.get(channel.id)}
          s={s}
          colors={colors}
          onSwipeWillOpen={handleSwipeWillOpen}
          onHide={() => {
            closeOpenSwipe();
            hideChannel(channel.id);
          }}
          onUnhide={() => {
            closeOpenSwipe();
            unhideChannel(channel.id);
          }}
          onArchive={
            isStaffOrAdmin && (isDm || channel.is_learning_space)
              ? () => {
                  closeOpenSwipe();
                  Alert.alert(
                    isDm ? 'Archive conversation' : 'Archive class',
                    isDm
                      ? 'Archive this conversation? It will move to read-only history.'
                      : 'Archive this class? Its channel becomes read-only, members are removed, and upcoming reminders are canceled. You can restore it from admin.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Archive',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await archiveChannel({ channelId: channel.id, orgId });
                            await Promise.all([
                              refetchDms(),
                              refetchChannels(),
                              refetchListedChannels(),
                              refetchSupervised(),
                            ]);
                          } catch {
                            Alert.alert('Error', 'Failed to archive conversation.');
                          }
                        },
                      },
                    ],
                  );
                }
              : undefined
          }
          onPress={() => {
            router.push({
              pathname,
              params: {
                channelId: channel.id,
                topic: displayTitle,
                avatarSeed,
                presenceProfileId,
                avatarUrl,
                avatarRole,
                avatarThemeKey,
                avatarTimezone,
                avatarCity,
                avatarCountryCode,
                avatarCountryName,
                iconKey,
                themeKey,
                messageUiThemeKey,
                subtitle,
                studentProfiles,
                participantProfiles,
                isLearningSpace,
                purpose: channel.purpose ?? (channel.is_support ? 'support' : ''),
                ...(channel.is_supervised
                  ? {
                      isSupervisedReadOnly: '1',
                      supervisedChildName: channel.supervised_child_name ?? '',
                      secondaryAvatarRole: 'child',
                    }
                  : {}),
              },
            } as never);
          }}
        />
      );
    },
    [
      s,
      colors,
      router,
      presenceByProfileId,
      currentProfileName,
      profileKind,
      draftsByChannelId,
      hideChannel,
      unhideChannel,
      hiddenChannelIds,
      hiddenSectionExpanded,
      isStaffOrAdmin,
      handleSwipeWillOpen,
      closeOpenSwipe,
      orgId,
      refetchDms,
      refetchChannels,
      refetchListedChannels,
      refetchSupervised,
    ],
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.title}>Messages</Text>
          <TouchableOpacity
            style={[
              s.headerAction,
              (!hasVisibleUnread || markingAllRead) && s.headerActionDisabled,
            ]}
            onPress={handleMarkAllRead}
            disabled={!hasVisibleUnread || markingAllRead}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Mark all visible conversations as read"
          >
            <Text style={s.headerActionText}>
              {markingAllRead ? 'Marking…' : 'Mark all read'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.tabBar}>
        {TABS.map(({ key, label, count }) => {
          const isActive = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[s.tab, isActive && s.tabActive]}
              onPress={() => setActiveTab(key)}
            >
              <View style={s.tabInner}>
                <Text style={[s.tabText, isActive && s.tabTextActive]}>{label}</Text>
                {count > 0 && (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeText}>{count > 9 ? '9+' : count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'channels' && isParentView && hasClassroomStudentTabs ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.subTabScroll}
          contentContainerStyle={s.subTabContent}
        >
          {classroomStudentTabs.map((tab) => {
            const isActive = activeStudentTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.subTab, isActive && s.subTabActive]}
                onPress={() => setActiveStudentTab(tab.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.subTabText,
                    isActive && s.subTabTextActive,
                    tab.key !== 'all'
                      ? {
                          color: themeTextColor(
                            tab.themeKey,
                            isActive ? colors.teal : colors.textMuted,
                          ),
                        }
                      : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {isLoading || refreshing ? (
        <ChannelListSkeleton count={6} />
      ) : (accountError || dmsError || channelsError || listedChannelsError) &&
        !dms &&
        !channels &&
        !listedChannels ? (
        <QueryError onRetry={onRefresh} />
      ) : isEmpty ? (
        <View style={s.emptyWrap}>
          <View style={[s.emptyIcon, { backgroundColor: colors.inputBg }]}>
            <emptyConfig.icon size={32} color={colors.textMuted} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>{emptyConfig.title}</Text>
          <Text style={[s.emptyDesc, { color: colors.textMuted }]}>
            {emptyConfig.desc}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => ('_type' in item ? item.id : item.id)}
          contentContainerStyle={s.listContent}
          onScrollBeginDrag={closeOpenSwipe}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
            />
          }
          ItemSeparatorComponent={() => (
            <View style={s.separator}>
              <View style={[s.separatorLine, { backgroundColor: colors.border }]} />
            </View>
          )}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}
