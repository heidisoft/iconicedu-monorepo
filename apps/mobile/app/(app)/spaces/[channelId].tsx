import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
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

  // ── Info sheet state ──
  const [infoVisible, setInfoVisible] = useState(false);

  const handleSend = useCallback(
    async (text: string) => {
      if (!channelId || !profileId || !orgId) return;
      await sendTextMessage(channelId, profileId, orgId, text);
    },
    [channelId, profileId, orgId],
  );

  if (!channelId) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <ConversationHeader
        title={topic ?? 'Learning Space'}
        kind="space"
        onBack={() => router.back()}
        onMore={() => setInfoVisible(true)}
      />
      <View style={[styles.flex, { backgroundColor: colors.pageBg }]}>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
