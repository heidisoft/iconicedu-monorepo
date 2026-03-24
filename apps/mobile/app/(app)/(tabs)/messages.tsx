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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpenCheck,
  ChevronRight,
  CircleOff,
  Clock3,
  MessageSquare,
  Minus,
} from 'lucide-react-native';
import { useAccount } from '@/hooks/use-account';
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
import type { ChannelListItem, DmParticipant } from '@/lib/api/queries';
import { ChannelListSkeleton } from '@/components/skeletons';
import { RoleAvatarBadge } from '@/components/profile/role-avatar-badge';

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

function themeTextColor(themeKey?: string | null, fallback?: string): string {
  return (themeKey && THEME_TEXT_COLORS[themeKey]) || fallback || '#64748b';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

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

    itemOuter: { marginHorizontal: 16 },
    itemWrap: {
      borderRadius: 14,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: 18,
      paddingVertical: 16,
      overflow: 'hidden',
    },
    itemWrapUnread: {
      backgroundColor: C.tealBg,
      borderColor: C.teal,
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    rowChevron: { flexShrink: 0, marginLeft: 8 },
    separator: { height: 10 },

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
      bottom: 1,
      right: 1,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: '#22c55e',
      borderWidth: 2,
      borderColor: C.card,
    },
    statusBadge: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 13,
      height: 13,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.card,
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
      borderColor: C.card,
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
      borderColor: C.card,
    },
    groupTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
    groupBadgeFront: { top: -3 },
    groupBadgeBack: { top: -3 },

    // ── Class avatar ──────────────────────────────────────────────────
    channelAvatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: C.tealBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    channelEmoji: { fontSize: 24 },

    content: { flex: 1, gap: 4 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowName: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
    },
    rowNameUnread: { fontWeight: '800' },
    rowMetaRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      flexShrink: 0,
      marginLeft: 'auto',
    },
    rowTime: { fontSize: 12, color: C.textFaint },
    rowMeta: { fontSize: 12, color: C.textFaint, lineHeight: 17 },
    rowMetaName: { fontWeight: '600' },
    rowPreview: { fontSize: 13, color: C.textMuted, lineHeight: 18 },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeTxt: { color: C.tealFg, fontSize: 11, fontWeight: '700' },

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
    return (
      <View style={[s.statusBadge, { backgroundColor: '#eab308' }]}>
        <Clock3 size={7} color="#ffffff" strokeWidth={2.6} />
      </View>
    );
  }

  if (status === 'busy') {
    return (
      <View style={[s.statusBadge, { backgroundColor: '#dc2626' }]}>
        <Minus size={8} color="#ffffff" strokeWidth={3} />
      </View>
    );
  }

  return (
    <View style={[s.statusBadge, { backgroundColor: '#4b5563' }]}>
      <CircleOff size={7} color="#ffffff" strokeWidth={2.4} />
    </View>
  );
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
              size={40}
              iconSize={20}
              borderRadius={14}
              backgroundColor={colors.inputBg}
              color={colors.text}
              style={s.channelAvatar}
            />
          )}

          {/* Content */}
          <View style={s.content}>
            <View style={s.topRow}>
              <Text style={[s.rowName, hasUnread && s.rowNameUnread]} numberOfLines={1}>
                {name}
              </Text>
              {item.is_supervised && (
                <View style={s.supervisedBadge}>
                  <Text style={s.supervisedBadgeTxt}>Supervised</Text>
                </View>
              )}
              <View style={s.rowMetaRight}>
                <Text style={s.rowTime}>{time}</Text>
                {hasUnread && (
                  <View style={s.badge}>
                    <Text style={s.badgeTxt}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                )}
              </View>
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
          <ChevronRight size={18} color={colors.textFaint} style={s.rowChevron} />
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
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  // Profile ID comes from the account query (profile joined in fetchUserAccount)
  const myProfileId =
    (
      (account as Record<string, unknown> | undefined)?.profile as Array<{
        id: string;
      }> | null
    )?.[0]?.id ?? '';

  const {
    data: dms,
    isPending: dmsLoading,
    refetch: refetchDms,
  } = useDirectMessages(orgId, myProfileId, accountId);
  const {
    data: channels,
    isPending: channelsLoading,
    refetch: refetchChannels,
  } = useLearningSpaceChannels(orgId, myProfileId, accountId);
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
    if (activeTab !== 'channels') {
      setActiveStudentTab('all');
      return;
    }

    if (
      activeStudentTab !== 'all' &&
      !classroomStudentTabs.some((tab) => tab.key === activeStudentTab)
    ) {
      setActiveStudentTab('all');
    }
  }, [activeStudentTab, activeTab, classroomStudentTabs]);

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
      const iconKey = !isDm ? (channel.icon_key ?? '') : '';
      const subtitle = isDm ? 'Direct Message' : (channel.description ?? '');
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
                iconKey,
                subtitle,
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
        <Text style={s.title}>Messages</Text>
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

      {activeTab === 'channels' && hasClassroomStudentTabs ? (
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
