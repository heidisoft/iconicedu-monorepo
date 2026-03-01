import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  const { channelId, topic, iconEmoji, subtitle } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    iconEmoji?: string;
    subtitle?: string;
  }>();
  const router = useRouter();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();

  const orgId = account?.org_id ?? '';
  const accountId = (account as Record<string, unknown> | undefined)?.id as string ?? '';
  const profileId = (profile as Record<string, unknown> | undefined)?.id as string ?? '';

  const { data: messages, isLoading, loadMore } = useMessages(channelId ?? '');

  const { schedules, isLoading: isLoadingSessions, error: sessionsError } = useSpaceSessions(
    channelId ?? '',
    orgId,
  );

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<SpaceTab>('messages');

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
      />

      {/* Tab bar: Messages | Sessions */}
      <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
        {(['messages', 'sessions'] as SpaceTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tabItem, isActive && { borderBottomColor: colors.teal }]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabLabel, { color: isActive ? colors.teal : colors.textMuted }]}>
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
          <MessageInput onSend={handleSend} placeholder={`Message ${topic ?? 'Learning Space'}…`} />
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
        title={topic ?? 'Learning Space'}
        subtitle={subtitle}
        kind="space"
        iconEmoji={iconEmoji}
        schedules={schedules}
        isLoadingSessions={isLoadingSessions}
        sessionsError={sessionsError}
        onClose={() => setInfoVisible(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: { border: string; teal: string; textMuted: string }) =>
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
      paddingVertical: 11,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
