import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useChannels } from '@/hooks/use-channels';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type { ChannelListItem } from '@/lib/api/queries';
type Tab = 'all' | 'dms' | 'channels';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatListTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitials(topic: string | null): string {
  const t = (topic ?? '?').trim();
  const words = t.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return t[0]?.toUpperCase() ?? '?';
}

const AVATAR_COLORS = ['#5B8DEF', '#E07B54', '#6CC070', '#A86CC1', '#E0A854', '#54B8C4', '#E06C8A'];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Header — matches Inbox exactly
    header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
    title:  { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

    // Full-width underline tab bar — matches Inbox exactly
    tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
    tab:           { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
    tabActive:     { borderBottomColor: C.teal },
    tabInner:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tabText:       { fontSize: 13, fontWeight: '600', color: C.textFaint },
    tabTextActive: { color: C.teal },
    tabBadge:      { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    tabBadgeText:  { fontSize: 10, fontWeight: '700', color: '#ffffff' },

    // Card row — matches Inbox itemOuter + itemWrap pattern
    itemOuter: { marginHorizontal: 16 },
    itemWrap:  {
      borderRadius: 14,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: 18,
      paddingVertical: 16,
      overflow: 'hidden',
    },
    itemRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },

    // Separator between cards — matches Inbox
    separator: { height: 10 },

    // DM avatar: colored circle with initials
    avatarWrap:    { position: 'relative', flexShrink: 0 },
    avatarCircle:  { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:     { color: '#fff', fontWeight: '700', fontSize: 18, letterSpacing: 0.3 },
    onlineDot:     { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2, borderColor: C.card },

    // Channel avatar: teal-tinted rounded square with emoji (matches Inbox icon style)
    channelAvatar: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: C.tealBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
    channelEmoji:  { fontSize: 24 },

    // Row content
    content:          { flex: 1, gap: 4 },
    topRow:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowName:          { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
    rowNameUnread:    { fontWeight: '800' },
    rowTime:          { fontSize: 12, color: C.textFaint },
    bottomRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowPreview:       { flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 18 },
    rowPreviewUnread: { color: C.text, fontWeight: '600' },
    forStudent:       { fontWeight: '600', color: C.teal },

    // Unread badge — right side of preview
    badge:    { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    badgeTxt: { color: C.tealFg, fontSize: 11, fontWeight: '700' },

    // Empty state — matches Inbox
    emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
    emptyIcon:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyDesc:  { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 21 },
  });
}

// ─── Row component ────────────────────────────────────────────────────────────

function ChannelRow({
  item,
  onPress,
  s,
  colors,
}: {
  item: ChannelListItem;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
  colors: AppColors;
}) {
  const isDm = item.kind === 'dm';
  const name = item.topic ?? (isDm ? 'Direct Message' : 'Channel');
  const text = item.last_message_text;
  const time = formatListTime(item.last_message_at ?? item.updated_at);
  const unread = item.unread_count ?? 0;
  const hasUnread = unread > 0;
  const bgColor = avatarColor(item.id);

  // For learning spaces: prefix preview with "For Tevin · " in teal
  const studentName = !isDm ? item.student_name : null;
  const previewText = text ?? item.description ?? '';

  return (
    <View style={s.itemOuter}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.itemWrap, pressed && { backgroundColor: colors.inputBg }]}
      >
        <View style={s.itemRow}>
          {/* Avatar: emoji tile for channels, colored initials circle + online dot for DMs */}
          {!isDm && item.icon_emoji ? (
            <View style={s.channelAvatar}>
              <Text style={s.channelEmoji}>{item.icon_emoji}</Text>
            </View>
          ) : (
            <View style={s.avatarWrap}>
              <View style={[s.avatarCircle, { backgroundColor: bgColor }]}>
                <Text style={s.avatarTxt}>{getInitials(name)}</Text>
              </View>
              <View style={s.onlineDot} />
            </View>
          )}

          {/* Content */}
          <View style={s.content}>
            <View style={s.topRow}>
              <Text style={[s.rowName, hasUnread && s.rowNameUnread]} numberOfLines={1}>{name}</Text>
              <Text style={s.rowTime}>{time}</Text>
            </View>
            <View style={s.bottomRow}>
              <Text style={[s.rowPreview, hasUnread && s.rowPreviewUnread]} numberOfLines={1}>
                {studentName
                  ? <><Text style={s.forStudent}>For {studentName}</Text>{'  '}{previewText}</>
                  : previewText
                }
              </Text>
              {hasUnread && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const orgId = account?.org_id ?? '';
  const profileId = (profile as Record<string, unknown> | undefined)?.id as string ?? '';

  const { data: dms, isLoading: dmsLoading, refetch: refetchDms } = useDirectMessages(orgId, profileId);
  const { data: channels, isLoading: channelsLoading, refetch: refetchChannels } = useChannels(orgId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDms(), refetchChannels()]);
    setRefreshing(false);
  }, [refetchDms, refetchChannels]);

  const allDms = useMemo(() => dms ?? [], [dms]);
  const allChannels = useMemo(() => channels ?? [], [channels]);

  const allItems = useMemo(() =>
    [...allDms, ...allChannels].sort((a, b) => {
      const ta = a.last_message_at ?? a.updated_at ?? '';
      const tb = b.last_message_at ?? b.updated_at ?? '';
      return tb.localeCompare(ta);
    }),
  [allDms, allChannels]);

  const data: ChannelListItem[] =
    activeTab === 'all' ? allItems :
    activeTab === 'dms' ? allDms :
    allChannels;

  // Unread counts for tab badges
  const unreadAll      = useMemo(() => allItems.reduce((n, i) => n + (i.unread_count ?? 0), 0), [allItems]);
  const unreadDms      = useMemo(() => allDms.reduce((n, i) => n + (i.unread_count ?? 0), 0), [allDms]);
  const unreadChannels = useMemo(() => allChannels.reduce((n, i) => n + (i.unread_count ?? 0), 0), [allChannels]);

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'all',      label: 'All',              count: unreadAll },
    { key: 'dms',      label: 'Direct Messages',  count: unreadDms },
    { key: 'channels', label: 'Learning Spaces',  count: unreadChannels },
  ];

  const isLoading = dmsLoading || channelsLoading;

  const emptyConfig = {
    all:      { icon: '💬', title: 'No messages yet',      desc: 'Your conversations will appear here' },
    dms:      { icon: '💬', title: 'No direct messages',   desc: 'Start a conversation with a tutor or educator' },
    channels: { icon: '📚', title: 'No learning spaces',   desc: 'Channels you join will appear here' },
  }[activeTab];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
      </View>

      {/* Full-width underline tab bar */}
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

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : data.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={[s.emptyIcon, { backgroundColor: colors.inputBg }]}>
            <Text style={{ fontSize: 32 }}>{emptyConfig.icon}</Text>
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>{emptyConfig.title}</Text>
          <Text style={[s.emptyDesc, { color: colors.textMuted }]}>{emptyConfig.desc}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item }) => (
            <ChannelRow
              item={item}
              s={s}
              colors={colors}
              onPress={() =>
                router.push({
                  pathname: item.kind === 'dm'
                    ? '/(app)/dm/[channelId]'
                    : '/(app)/channel/[channelId]',
                  params: { channelId: item.id, topic: item.topic ?? '' },
                } as never)
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
