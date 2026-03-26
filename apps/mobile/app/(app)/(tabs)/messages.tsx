import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpenCheck, MessageSquare } from 'lucide-react-native';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useLearningSpaceChannels } from '@/hooks/use-learning-space-channels';
import {
  useOnlineProfileIds,
  type PresenceDisplayStatus,
} from '@/hooks/use-online-profile-ids';
import { useSupervisedDirectMessages } from '@/hooks/use-supervised-direct-messages';
import { useTheme } from '@/providers/theme-provider';
import { LearningSpaceIconBadge } from '@/lib/learning-space-icons';
import type { AppColors } from '@/lib/theme';
import { createHeaderSurface } from '@/lib/header-surface';
import {
  markChannelsReadByIds,
  type ChannelListItem,
  type DmParticipant,
} from '@/lib/api/queries';
import { ChannelListSkeleton } from '@/components/skeletons';
import { RoleAvatarBadge } from '@/components/profile/role-avatar-badge';
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';

type Tab = 'all' | 'dms' | 'channels';
type ClassroomStudentTab = 'all' | string;

type SectionHeaderItem = { _type: 'section-header'; title: string; id: string };
type ListRow = ChannelListItem | SectionHeaderItem;

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

const AVATAR_COLORS = [
  '#5B8DEF',
  '#E07B54',
  '#6CC070',
  '#A86CC1',
  '#E0A854',
  '#54B8C4',
  '#E06C8A',
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const THEME_TEXT_COLORS: Record<string, string> = {
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
  teal: '#0d9488',
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

const THEME_AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
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

function themeTextColor(themeKey?: string | null, fallback?: string): string {
  return (themeKey && THEME_TEXT_COLORS[themeKey]) || fallback || '#64748b';
}

function themeAvatarColor(
  themeKey?: string | null,
  fallbackBg?: string,
  fallbackFg?: string,
): { bg: string; fg: string } {
  return (
    (themeKey && THEME_AVATAR_COLORS[themeKey]) || {
      bg: fallbackBg || '#f8fafc',
      fg: fallbackFg || '#0f172a',
    }
  );
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
    title: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
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
      fontSize: 12,
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
    tabText: { fontSize: 13, fontWeight: '600', color: C.textFaint },
    tabTextActive: { color: C.teal },
    tabBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#ef4444',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
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
    subTabText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
    subTabTextActive: { color: C.teal },

    itemOuter: {
      marginHorizontal: 16,
      marginBottom: 16,
    },
    itemWrap: {
      backgroundColor: 'transparent',
      paddingHorizontal: 16,
      paddingVertical: 18,
      overflow: 'hidden',
    },
    itemWrapUnread: {},
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    separator: { height: 0 },

    // ── DM avatar — single person ──────────────────────────────────────────────
    avatarWrap: { position: 'relative', width: 44, height: 44, flexShrink: 0 },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
    onlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: '#22c55e',
      borderWidth: 2,
      borderColor: C.bg,
    },
    statusBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 13,
      height: 13,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.bg,
    },

    // ── DM avatar — group (stacked) ────────────────────────────────────────────
    groupWrap: { width: 44, height: 44, flexShrink: 0, position: 'relative' },
    groupBack: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.bg,
    },
    groupFront: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.bg,
    },
    groupTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
    groupBadgeFront: {},
    groupBadgeBack: {},

    // ── Class avatar ──────────────────────────────────────────────────
    channelAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderWidth: 0,
    },
    channelEmoji: { fontSize: 24 },

    content: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowNameWrap: { flex: 1, minWidth: 0 },
    rowName: { fontSize: 15, fontWeight: '700', color: C.text },
    rowNameUnread: { fontWeight: '800' },
    rowTail: {
      width: 64,
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      flexShrink: 0,
      alignSelf: 'stretch',
      paddingVertical: 2,
    },
    rowTime: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
    rowMeta: { fontSize: 12, color: C.textMuted, lineHeight: 18 },
    rowMetaName: { fontWeight: '600' },
    rowPreview: { fontSize: 12, color: C.textMuted, lineHeight: 18 },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeTxt: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

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
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyDesc: {
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 21,
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
    supervisedBadgeTxt: { fontSize: 10, fontWeight: '700', color: C.teal },

    // ── Section header ─────────────────────────────────────────────────────────
    sectionHeaderWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
    sectionHeaderTxt: {
      fontSize: 11,
      fontWeight: '700',
      color: C.textFaint,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
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
    return <View style={[s.statusBadge, { backgroundColor: '#eab308' }]} />;
  }

  if (status === 'busy') {
    return <View style={[s.statusBadge, { backgroundColor: '#dc2626' }]} />;
  }

  return <View style={[s.statusBadge, { backgroundColor: '#4b5563' }]} />;
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
          <Image
            source={{ uri: back!.avatar_url }}
            style={s.groupBack}
            accessibilityLabel={participantName(back!)}
          />
        ) : (
          <View style={[s.groupBack, { backgroundColor: avatarColor(back!.id) }]}>
            <Text style={s.groupTxt}>{getInitials(participantName(back!))}</Text>
          </View>
        )}
        <RoleAvatarBadge role={back?.kind} size={14} style={s.groupBadgeBack} />
        {front!.avatar_url ? (
          <Image
            source={{ uri: front!.avatar_url }}
            style={s.groupFront}
            accessibilityLabel={participantName(front!)}
          />
        ) : (
          <View style={[s.groupFront, { backgroundColor: avatarColor(front!.id) }]}>
            <Text style={s.groupTxt}>{getInitials(participantName(front!))}</Text>
          </View>
        )}
        <RoleAvatarBadge role={front?.kind} size={14} style={s.groupBadgeFront} />
        <PresenceBadge status={presenceStatus ?? 'offline'} s={s} />
      </View>
    );
  }

  const person = participants[0];
  const name = person ? participantName(person) : null;
  const color = avatarColor(person?.id ?? fallbackId);

  return (
    <View style={s.avatarWrap}>
      {person?.avatar_url ? (
        <Image
          source={{ uri: person.avatar_url }}
          style={s.avatarCircle}
          accessibilityLabel={name ?? undefined}
        />
      ) : (
        <View style={[s.avatarCircle, { backgroundColor: color }]}>
          <Text style={s.avatarTxt}>{getInitials(name)}</Text>
        </View>
      )}
      {/* Online dot — presence tracking can be layered on top later */}
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

// ─── Row component ────────────────────────────────────────────────────────────

function ChannelRow({
  item,
  onPress,
  presenceByProfileId,
  s,
  colors,
}: {
  item: ChannelListItem;
  onPress: () => void;
  presenceByProfileId: Map<string, PresenceDisplayStatus>;
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
  const presenceStatus = isDm
    ? (presenceByProfileId.get(avatarParticipants[0]?.id ?? '') ?? 'offline')
    : null;

  const text = item.last_message_text;
  const sender = item.last_message_sender;
  const time = formatListTime(item.last_message_at ?? item.updated_at);
  const unread = item.unread_count ?? 0;
  const hasUnread = unread > 0;
  const studentProfiles = !isDm ? (item.student_profiles ?? []) : [];
  const classThemeKey = !isDm ? (item.themeKey ?? null) : null;
  const classAvatarColors = themeAvatarColor(classThemeKey, colors.inputBg, colors.text);
  const hasChannelMeta =
    !isDm && (Boolean(item.description) || studentProfiles.length > 0);
  const dmPreviewText =
    item.is_supervised && item.supervised_child_name
      ? `Viewing ${item.supervised_child_name}'s conversation`
      : text
        ? !isDm && sender
          ? `${sender}: ${text}`
          : text
        : (item.description ?? '');

  return (
    <View style={s.itemOuter}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
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
            <LearningSpaceIconBadge
              iconKey={item.icon_key}
              size={44}
              iconSize={20}
              borderRadius={22}
              backgroundColor={classAvatarColors.bg}
              color={classAvatarColors.fg}
              style={s.channelAvatar}
            />
          )}

          {/* Content */}
          <View style={s.content}>
            <View style={s.topRow}>
              <RoleNameIndicator
                name={name}
                role={displayRole}
                containerStyle={s.rowNameWrap}
                textStyle={[s.rowName, hasUnread && s.rowNameUnread]}
                numberOfLines={1}
                iconSize={13}
              />
              {item.is_supervised && (
                <View style={s.supervisedBadge}>
                  <Text style={s.supervisedBadgeTxt}>Supervised</Text>
                </View>
              )}
            </View>
            {!isDm && hasChannelMeta ? (
              <Text style={s.rowMeta} numberOfLines={1}>
                {item.description ?? ''}
                {item.description && studentProfiles.length > 0 ? ' · ' : ''}
                {studentProfiles.map((student, index) => (
                  <Text
                    key={`${item.id}-student-${student.name}-${index}`}
                    style={[
                      s.rowMetaName,
                      { color: themeTextColor(student.themeKey, colors.textMuted) },
                    ]}
                  >
                    {index > 0 ? ', ' : ''}
                    {student.name}
                  </Text>
                ))}
              </Text>
            ) : null}
            {isDm && dmPreviewText ? (
              <Text style={s.rowPreview} numberOfLines={1}>
                {dmPreviewText}
              </Text>
            ) : null}
          </View>
          <View style={s.rowTail}>
            <Text style={s.rowTime} numberOfLines={1}>
              {time}
            </Text>
            {hasUnread ? (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : (
              <View />
            )}
          </View>
        </View>
      </Pressable>
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

  const { data: account, isPending: accountLoading } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const myProfileId =
    ((profile as Record<string, unknown> | undefined)?.id as string | undefined) ?? '';
  const profileKind =
    ((profile as Record<string, unknown> | undefined)?.kind as string | undefined) ??
    null;
  const isStudentView = profileKind === 'child';

  const {
    data: dms,
    isPending: dmsLoading,
    refetch: refetchDms,
  } = useDirectMessages(orgId, myProfileId, accountId);
  const {
    data: channels,
    isPending: channelsLoading,
    refetch: refetchChannels,
  } = useLearningSpaceChannels(orgId, myProfileId, accountId, profileKind);
  const {
    data: supervisedDms,
    isPending: supervisedLoading,
    refetch: refetchSupervised,
  } = useSupervisedDirectMessages(orgId, accountId, myProfileId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDms(), refetchChannels(), refetchSupervised()]);
    setRefreshing(false);
  }, [refetchDms, refetchChannels, refetchSupervised]);

  const allDms = useMemo(() => dms ?? [], [dms]);
  const allChannels = useMemo(() => channels ?? [], [channels]);
  const classroomChannels = useMemo(
    () => allChannels.filter((channel) => !channel.is_support),
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
    if (activeTab !== 'channels' || isStudentView) {
      setActiveStudentTab('all');
      return;
    }

    if (
      activeStudentTab !== 'all' &&
      !classroomStudentTabs.some((tab) => tab.key === activeStudentTab)
    ) {
      setActiveStudentTab('all');
    }
  }, [activeStudentTab, activeTab, classroomStudentTabs, isStudentView]);

  const allItems = useMemo(
    () =>
      [...allDms, ...allSupervisedDms, ...allChannels].sort((a, b) => {
        const ta = a.last_message_at ?? a.updated_at ?? '';
        const tb = b.last_message_at ?? b.updated_at ?? '';
        return tb.localeCompare(ta);
      }),
    [allDms, allSupervisedDms, allChannels],
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

  const data: ListRow[] =
    activeTab === 'all'
      ? allItems
      : activeTab === 'dms'
        ? dmsData
        : filteredClassroomChannels;

  const unreadAll = useMemo(
    () => allItems.reduce((n, i) => n + (i.unread_count ?? 0), 0),
    [allItems],
  );
  const unreadDms = useMemo(
    () => [...allDms, ...allSupervisedDms].reduce((n, i) => n + (i.unread_count ?? 0), 0),
    [allDms, allSupervisedDms],
  );
  const unreadChannels = useMemo(
    () => classroomChannels.reduce((n, i) => n + (i.unread_count ?? 0), 0),
    [classroomChannels],
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: unreadAll },
    { key: 'dms', label: 'Direct Messages', count: unreadDms },
    { key: 'channels', label: 'Classrooms', count: unreadChannels },
  ];

  const isLoading = accountLoading || dmsLoading || channelsLoading || supervisedLoading;
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const visibleUnreadChannelIds = useMemo(
    () =>
      data
        .filter((item): item is ChannelListItem => !('_type' in item))
        .filter((item) => (item.unread_count ?? 0) > 0)
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
              await Promise.all([refetchDms(), refetchChannels(), refetchSupervised()]);
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

  const isEmpty = data.length === 0 || (data.length === 1 && '_type' in data[0]!);

  const renderItem = useCallback(
    ({ item }: { item: ListRow }) => {
      if ('_type' in item && item._type === 'section-header') {
        return <SectionHeader title={item.title} s={s} />;
      }
      const channel = item as ChannelListItem;
      const isDm = channel.kind === 'dm';
      const participants = channel.participants ?? [];
      // For supervised DMs, topic = the partner's name (child is excluded from participants).
      // The DM screen will build "ChildName <> PartnerName" from these two values.
      const partnerTitle =
        participants.length > 0
          ? participants.map(participantName).join(', ')
          : (channel.topic ?? 'Direct Message');
      const displayTitle = isDm ? partnerTitle : (channel.topic ?? 'Channel');
      const avatarSeed = isDm ? (participants[0]?.id ?? '') : '';
      const avatarUrl = isDm ? (participants[0]?.avatar_url ?? '') : '';
      const avatarRole = isDm ? (participants[0]?.kind ?? '') : '';
      const avatarTimezone = isDm ? (participants[0]?.timezone ?? '') : '';
      const iconKey = !isDm ? (channel.icon_key ?? '') : '';
      const themeKey = !isDm ? (channel.themeKey ?? '') : '';
      const subtitle = isDm ? 'Direct Message' : (channel.description ?? '');
      const studentProfiles = !isDm ? JSON.stringify(channel.student_profiles ?? []) : '';
      const isLearningSpace = !isDm && !channel.is_support ? '1' : '0';
      return (
        <ChannelRow
          item={channel}
          presenceByProfileId={presenceByProfileId}
          s={s}
          colors={colors}
          onPress={() => {
            router.push({
              pathname: isDm ? '/(app)/dm/[channelId]' : '/(app)/channel/[channelId]',
              params: {
                channelId: channel.id,
                topic: displayTitle,
                avatarSeed,
                avatarUrl,
                avatarRole,
                avatarTimezone,
                iconKey,
                themeKey,
                subtitle,
                studentProfiles,
                isLearningSpace,
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
    [s, colors, router, presenceByProfileId],
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

      {activeTab === 'channels' && !isStudentView && hasClassroomStudentTabs ? (
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
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
            />
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}
