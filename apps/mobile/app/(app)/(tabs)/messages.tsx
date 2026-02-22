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

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: C.bg },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header:       { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
    title:        { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    searchRow:    { paddingHorizontal: 16, paddingVertical: 10 },
    searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10 },
    searchIcon:   { fontSize: 14 },
    searchInput:  { flex: 1, fontSize: 14, color: C.text },
    clearX:       { fontSize: 18, color: C.textFaint, lineHeight: 20 },
    tabRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16 },
    tab:          { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive:    { borderBottomWidth: 2, borderBottomColor: C.teal, marginBottom: -1 },
    tabTxt:       { fontSize: 13, fontWeight: '600', color: C.textFaint },
    tabTxtActive: { color: C.teal },
    separator:    { height: 1, backgroundColor: C.border, marginLeft: 68 },
    empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
    emptyIcon:    { fontSize: 40 },
    emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
    emptyDesc:    { fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 32 },
    row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    rowPressed:   { backgroundColor: C.inputBg },
    rowAvatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
    rowAvatarTxt: { color: C.tealFg, fontWeight: '700', fontSize: 17 },
    rowBody:      { flex: 1, gap: 2 },
    rowTitle:     { fontSize: 15, fontWeight: '600', color: C.text },
    rowSub:       { fontSize: 13, color: C.textMuted },
    badge:        { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    badgeTxt:     { color: C.tealFg, fontSize: 11, fontWeight: '700' },
  });
}

export default function MessagesScreen() {
  const [activeTab, setActiveTab] = useState<'dms' | 'channels'>('dms');
  const [search, setSearch] = useState('');
  const { data: account } = useAccount();
  const { colors } = useTheme();
  const router = useRouter();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

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
    if (!dms) return [];
    if (!search) return dms;
    const q = search.toLowerCase();
    return dms.filter((dm: Record<string, unknown>) =>
      ((dm.topic as string) ?? '').toLowerCase().includes(q),
    );
  }, [dms, search]);

  const filteredChannels = useMemo(() => {
    if (!channels) return [];
    if (!search) return channels;
    const q = search.toLowerCase();
    return channels.filter((ch: Record<string, unknown>) =>
      ((ch.topic as string) ?? '').toLowerCase().includes(q),
    );
  }, [channels, search]);

  const isLoading = activeTab === 'dms' ? dmsLoading : channelsLoading;
  const data = activeTab === 'dms' ? filteredDms : filteredChannels;

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
          keyExtractor={(item) => (item as Record<string, unknown>).id as string}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
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
          renderItem={({ item }) => {
            const rec = item as Record<string, unknown>;
            const topic = (rec.topic as string) ?? (activeTab === 'dms' ? 'Direct Message' : 'Channel');
            const unread = (rec.unread_count as number) ?? 0;
            const initial = topic[0]?.toUpperCase() ?? '?';
            return (
              <Pressable
                style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                onPress={() =>
                  router.push(
                    (activeTab === 'dms'
                      ? `/(app)/dm/${rec.id as string}`
                      : `/(app)/channel/${rec.id as string}`) as never,
                  )
                }
              >
                <View style={s.rowAvatar}>
                  <Text style={s.rowAvatarTxt}>{initial}</Text>
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>{topic}</Text>
                  <Text style={s.rowSub}>
                    {activeTab === 'dms' ? 'Tap to open conversation' : ((rec.description as string) ?? '')}
                  </Text>
                </View>
                {unread > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeTxt}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
