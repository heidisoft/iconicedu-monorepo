import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useChannels } from '@/hooks/use-channels';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type { ChannelListItem } from '@/lib/api/queries';
import {
  DEMO_DM_CHANNELS,
  DEMO_CHANNEL_LIST,
} from '@/lib/dummy-messages';

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

function getInitial(topic: string | null): string {
  return (topic ?? '?')[0]?.toUpperCase() ?? '?';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: C.bg },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header:       { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
    title:        { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

    searchRow:    { paddingHorizontal: 16, paddingVertical: 10 },
    searchBox:    {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.inputBg, borderRadius: 12,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    searchIcon:   { fontSize: 14 },
    searchInput:  { flex: 1, fontSize: 14, color: C.text },
    clearX:       { fontSize: 18, color: C.textFaint, lineHeight: 20 },

    tabRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16 },
    tab:          { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive:    { borderBottomWidth: 2, borderBottomColor: C.teal, marginBottom: -1 },
    tabTxt:       { fontSize: 13, fontWeight: '600', color: C.textFaint },
    tabTxtActive: { color: C.teal },

    separator:    { height: 1, backgroundColor: C.border, marginLeft: 76 },

    empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
    emptyIcon:    { fontSize: 40 },
    emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
    emptyDesc:    { fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 32 },

    // ── Row ──
    row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
    rowPressed:   { backgroundColor: C.inputBg },

    // Avatar
    avatarWrap:   { position: 'relative' },
    avatar:       {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: C.teal,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarTxt:    { color: C.tealFg, fontWeight: '700', fontSize: 19 },
    onlineDot:    {
      position: 'absolute', bottom: 1, right: 1,
      width: 13, height: 13, borderRadius: 7,
      backgroundColor: '#22c55e',
      borderWidth: 2, borderColor: C.bg,
    },

    // Body
    rowBody:      { flex: 1, gap: 2 },

    topRow:       { flexDirection: 'row', alignItems: 'center' },
    rowName:      { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
    rowTime:      { fontSize: 12, color: C.textFaint },

    bottomRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowPreview:   { flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 18 },
    rowPreviewUnread: { color: C.text, fontWeight: '600' },

    // Unread badge
    badge:        {
      minWidth: 20, height: 20, borderRadius: 10,
      backgroundColor: C.teal,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeTxt:     { color: C.tealFg, fontSize: 11, fontWeight: '700' },

    // Channel hash pill
    hashPill:     {
      width: 50, height: 50, borderRadius: 14,
      backgroundColor: C.tealBg, borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    hashTxt:      { fontSize: 22, color: C.teal },
  });
}

// ─── Row component ────────────────────────────────────────────────────────────

function ChannelRow({
  item,
  isDm,
  onPress,
  s,
  colors,
}: {
  item: ChannelListItem;
  isDm: boolean;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
  colors: AppColors;
}) {
  const name = item.topic ?? (isDm ? 'Direct Message' : 'Channel');
  const preview = item.last_message_text ?? (isDm ? 'Tap to open conversation' : (item.description ?? ''));
  const time = formatListTime(item.last_message_at ?? item.updated_at);
  const unread = item.unread_count ?? 0;
  const hasUnread = unread > 0;

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && s.rowPressed]}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={s.avatarWrap}>
        {isDm ? (
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{getInitial(name)}</Text>
          </View>
        ) : (
          <View style={s.hashPill}>
            <Text style={s.hashTxt}>#</Text>
          </View>
        )}
        {/* Online dot — shown on DMs (always visible until presence is wired) */}
        {isDm && <View style={s.onlineDot} />}
      </View>

      {/* Body */}
      <View style={s.rowBody}>
        <View style={s.topRow}>
          <Text style={s.rowName} numberOfLines={1}>{name}</Text>
          <Text style={s.rowTime}>{time}</Text>
        </View>
        <View style={s.bottomRow}>
          <Text
            style={[s.rowPreview, hasUnread && s.rowPreviewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {hasUnread && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const [activeTab, setActiveTab] = useState<'dms' | 'channels'>('dms');
  const [search, setSearch] = useState('');
  const { data: account } = useAccount();
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const orgId = account?.org_id ?? '';
  const profileId = account?.default_profile_id ?? '';

  const { data: dms, isLoading: dmsLoading, refetch: refetchDms } = useDirectMessages(orgId, profileId);
  const { data: channels, isLoading: channelsLoading, refetch: refetchChannels } = useChannels(orgId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDms(), refetchChannels()]);
    setRefreshing(false);
  }, [refetchDms, refetchChannels]);

  const filteredDms = useMemo(() => {
    const allDms = [...DEMO_DM_CHANNELS, ...(dms ?? [])];
    if (!search) return allDms;
    const q = search.toLowerCase();
    return allDms.filter((dm) => (dm.topic ?? '').toLowerCase().includes(q));
  }, [dms, search]);

  const filteredChannels = useMemo(() => {
    const allChannels = [...DEMO_CHANNEL_LIST, ...(channels ?? [])];
    if (!search) return allChannels;
    const q = search.toLowerCase();
    return allChannels.filter((ch) => (ch.topic ?? '').toLowerCase().includes(q));
  }, [channels, search]);

  const isLoading = activeTab === 'dms' ? dmsLoading : channelsLoading;
  const data: ChannelListItem[] = activeTab === 'dms' ? filteredDms : filteredChannels;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
      </View>

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search messages…"
            placeholderTextColor={colors.textFaint}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Text style={s.clearX}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={s.tabRow}>
        {(['dms', 'channels'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
              {tab === 'dms' ? 'Direct Messages' : 'Channels'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>{activeTab === 'dms' ? '💬' : '📢'}</Text>
              <Text style={s.emptyTitle}>
                {activeTab === 'dms' ? 'No direct messages' : 'No channels'}
              </Text>
              <Text style={s.emptyDesc}>
                {activeTab === 'dms'
                  ? 'Start a conversation with someone'
                  : 'Channels you join will appear here'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ChannelRow
              item={item}
              isDm={activeTab === 'dms'}
              s={s}
              colors={colors}
              onPress={() =>
                router.push({
                  pathname: activeTab === 'dms' ? '/(app)/dm/[channelId]' : '/(app)/channel/[channelId]',
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
