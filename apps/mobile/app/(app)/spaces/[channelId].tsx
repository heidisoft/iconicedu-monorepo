import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MessageCircle, CalendarDays } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useMessages } from '@/hooks/use-messages';
import { useSpaceSessions } from '@/hooks/use-space-sessions';
import { sendTextMessage } from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { ChannelInfoSheet } from '@/components/messages/channel-info-sheet';
import { SpaceSessionsTab } from '@/components/messages/space-sessions-tab';

type SpaceTab = 'messages' | 'sessions';

export default function SpaceDetailScreen() {
  const { channelId, topic, iconEmoji, subtitle, tab } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    iconEmoji?: string;
    subtitle?: string;
    tab?: string;
  }>();
  const router = useRouter();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const profileId =
    ((profile as Record<string, unknown> | undefined)?.id as string) ?? '';

  const { data: messages, isLoading, loadMore } = useMessages(channelId ?? '');

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

  if (!channelId) return null;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <ConversationHeader
        title={topic ?? 'Learning Space'}
        kind="space"
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
            onLoadMore={loadMore}
            loading={isLoading}
          />
          <TypingIndicator typingUsers={[]} />
          <MessageInput
            onSend={handleSend}
            placeholder={`Message ${topic ?? 'Learning Space'}…`}
          />
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
        title={topic ?? 'Learning Space'}
        subtitle={subtitle}
        kind="space"
        iconEmoji={iconEmoji}
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
