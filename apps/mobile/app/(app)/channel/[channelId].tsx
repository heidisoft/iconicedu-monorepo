import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useMessages } from '@/hooks/use-messages';
import { sendTextMessage } from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { DEMO_MESSAGE_MAP, DEMO_PROFILE_ID } from '@/lib/dummy-messages';

export default function ChannelConversationScreen() {
  const { channelId, topic } = useLocalSearchParams<{ channelId: string; topic?: string }>();
  const router = useRouter();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();

  const isDemo = channelId?.startsWith('demo-') ?? false;

  const profileId = isDemo ? DEMO_PROFILE_ID : ((profile as Record<string, unknown> | undefined)?.id as string ?? '');
  const orgId = account?.org_id ?? '';

  // Skip API for demo channels — they have no real DB row
  const { data: realMessages, isLoading, loadMore } = useMessages(isDemo ? '' : (channelId ?? ''));
  const messages = isDemo ? (DEMO_MESSAGE_MAP[channelId ?? ''] ?? []) : (realMessages ?? []);

  const handleSend = useCallback(
    async (text: string) => {
      if (isDemo || !channelId || !profileId || !orgId) return;
      await sendTextMessage(channelId, profileId, orgId, text);
    },
    [isDemo, channelId, profileId, orgId],
  );

  if (!channelId) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <ConversationHeader
        title={topic ?? 'Channel'}
        kind="channel"
        onBack={() => router.back()}
      />
      <View style={[styles.flex, { backgroundColor: colors.pageBg }]}>
        <MessageList
          messages={messages}
          currentProfileId={profileId}
          onLoadMore={isDemo ? undefined : loadMore}
          loading={isDemo ? false : isLoading}
        />
        <TypingIndicator typingUsers={[]} />
        <MessageInput onSend={handleSend} placeholder={`Message #${topic ?? ''}…`} disabled={isDemo} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
