import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useMessages } from '@/hooks/use-messages';
import { sendTextMessage } from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';

export default function SpaceDetailScreen() {
  const { channelId, topic } = useLocalSearchParams<{ channelId: string; topic?: string }>();
  const router = useRouter();
  const { data: account } = useAccount();
  const { colors } = useTheme();

  const profileId = account?.default_profile_id ?? '';
  const orgId = account?.org_id ?? '';

  const { data: messages, isLoading, loadMore } = useMessages(channelId ?? '');

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
      />
      <View style={[styles.flex, { backgroundColor: colors.pageBg }]}>
        <MessageList
          messages={messages ?? []}
          currentProfileId={profileId}
          onLoadMore={loadMore}
          loading={isLoading}
        />
        <TypingIndicator typingUsers={[]} />
        <MessageInput onSend={handleSend} placeholder={`Message ${topic ?? 'Learning Space'}…`} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
