import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MessageCircle, CalendarDays } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useMessages } from '@/hooks/use-messages';
import { useSpaceSessions } from '@/hooks/use-space-sessions';
import {
  sendTextMessage,
  markChannelReadState,
  fetchSpaceChannelMetaByChannelId,
  fetchChannelReadState,
  queryKeys,
} from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { ChannelInfoSheet } from '@/components/messages/channel-info-sheet';
import { SpaceSessionsTab } from '@/components/messages/space-sessions-tab';

type SpaceTab = 'messages' | 'sessions';

export default function SpaceDetailScreen() {
  const { channelId, topic, iconKey, themeKey, subtitle, tab } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    iconKey?: string;
    themeKey?: string;
    subtitle?: string;
    tab?: string;
  }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const profileId =
    ((profile as Record<string, unknown> | undefined)?.id as string) ?? '';

  const { data: messages, isLoading, loadMore } = useMessages(channelId ?? '');
  const { data: spaceMeta, isLoading: isLoadingMeta } = useQuery({
    queryKey: queryKeys.spaceChannelMeta(channelId ?? ''),
    queryFn: () => fetchSpaceChannelMetaByChannelId(channelId ?? ''),
    enabled: !!channelId,
    staleTime: 5 * 60 * 1000,
  });
  const { data: channelReadState } = useQuery({
    queryKey: queryKeys.channelReadState(channelId ?? '', accountId),
    queryFn: () => fetchChannelReadState(channelId ?? '', accountId),
    enabled: !!channelId && !!accountId,
    staleTime: 30_000,
  });

  const {
    schedules,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useSpaceSessions(channelId ?? '', orgId);

  // ── Live session detection — mirrors web channel.context?.liveSession?.enabled check ──
  const liveSession = useMemo(() => {
    if (!schedules?.length) return null;
    const now = Date.now();
    return (
      schedules.find((s) => {
        const start = Date.parse(s.startAt);
        const end = Date.parse(s.endAt);
        return start <= now && end >= now && !!s.meetingLink;
      }) ?? null
    );
  }, [schedules]);

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<SpaceTab>(
    tab === 'sessions' ? 'sessions' : 'messages',
  );

  // ── Info sheet state ──
  const [infoVisible, setInfoVisible] = useState(false);

  const handleSend = useCallback(
    async (text: string) => {
      if (!channelId || !profileId || !orgId) return;
      await sendTextMessage(channelId, profileId, orgId, text);
    },
    [channelId, profileId, orgId],
  );

  const s = useMemo(() => makeStyles(colors), [colors]);

  const lastMarkedReadIdRef = React.useRef<string | null>(null);
  const handleUnreadViewed = useCallback(
    async (lastReadMessageId: string) => {
      if (!channelId || !orgId || !accountId || !profileId || !lastReadMessageId) {
        return;
      }
      if (lastMarkedReadIdRef.current === lastReadMessageId) {
        return;
      }
      lastMarkedReadIdRef.current = lastReadMessageId;
      try {
        await markChannelReadState({
          orgId,
          accountId,
          profileId,
          channelId,
          lastReadMessageId,
        });
      } catch {
        // best effort read-state sync
      }
    },
    [accountId, channelId, orgId, profileId],
  );
  if (!channelId) return null;

  const resolvedTitle = spaceMeta?.title ?? topic ?? 'Class';
  const resolvedSubtitle = (spaceMeta?.subtitle ?? subtitle ?? '').trim() || null;
  const resolvedStudentProfiles = spaceMeta?.studentProfiles ?? [];
  const resolvedIconKey = spaceMeta?.iconKey ?? iconKey ?? null;
  const resolvedThemeKey = spaceMeta?.themeKey ?? themeKey ?? null;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <ConversationHeader
        title={resolvedTitle}
        kind="space"
        subtitle={resolvedSubtitle}
        studentProfiles={resolvedStudentProfiles}
        iconKey={resolvedIconKey}
        themeKey={resolvedThemeKey}
        loading={isLoadingMeta && !spaceMeta && !topic}
        onBack={() => router.back()}
        onMore={() => setInfoVisible(true)}
        liveJoinUrl={liveSession?.meetingLink ?? null}
      />

      {/* Tab bar: Messages | Sessions */}
      <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
        {(['messages', 'sessions'] as SpaceTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const color = isActive ? colors.teal : colors.textMuted;
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tabItem, isActive && { borderBottomColor: colors.teal }]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              {tab === 'messages' ? (
                <MessageCircle size={16} color={color} />
              ) : (
                <CalendarDays size={16} color={color} />
              )}
              <Text style={[s.tabLabel, { color }]}>
                {tab === 'messages' ? 'Messages' : 'Sessions'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === 'messages' ? (
        <View style={[s.flex, { backgroundColor: colors.pageBg }]}>
          <MessageList
            messages={messages ?? []}
            currentProfileId={profileId}
            currentAccountId={accountId}
            lastReadMessageId={channelReadState?.lastReadMessageId ?? null}
            unreadCount={channelReadState?.unreadCount ?? 0}
            onLoadMore={loadMore}
            loading={isLoading}
            onUnreadViewed={handleUnreadViewed}
            isScreenActive={isFocused && activeTab === 'messages'}
            emptyTitle="Start the conversation"
            emptyDescription="Share a welcome message, lesson update, or question to begin the class discussion."
          />
          <TypingIndicator typingUsers={[]} />
          <MessageInput onSend={handleSend} placeholder={`Message ${resolvedTitle}…`} />
        </View>
      ) : (
        <View style={[s.flex, { backgroundColor: colors.pageBg }]}>
          <SpaceSessionsTab
            schedules={schedules ?? []}
            isLoading={isLoadingSessions}
            error={sessionsError}
          />
        </View>
      )}

      {/* Info sheet */}
      <ChannelInfoSheet
        visible={infoVisible}
        channelId={channelId ?? ''}
        title={resolvedTitle}
        subtitle={resolvedSubtitle}
        kind="space"
        iconKey={resolvedIconKey}
        themeKey={resolvedThemeKey}
        messages={messages ?? []}
        onClose={() => setInfoVisible(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (_colors: { border: string; teal: string; textMuted: string }) =>
  StyleSheet.create({
    safe: { flex: 1 },
    flex: { flex: 1 },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 11,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
