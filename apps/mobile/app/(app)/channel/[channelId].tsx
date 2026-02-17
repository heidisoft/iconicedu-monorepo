import React, { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader, StyledView, Avatar } from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useMessages } from '@/hooks/use-messages';
import { sendTextMessage } from '@/lib/api/queries';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';

export default function ChannelConversationScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const { data: account } = useAccount();
  const { data: messages, isLoading, loadMore } = useMessages(channelId ?? '');

  const profileId = account?.default_profile_id ?? '';
  const orgId = account?.org_id ?? '';

  const handleSend = useCallback(
    async (text: string) => {
      if (!channelId || !profileId || !orgId) return;
      await sendTextMessage(channelId, profileId, orgId, text);
    },
    [channelId, profileId, orgId],
  );

  if (!channelId) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }} edges={['top']}>
      <ScreenHeader
        title="Channel"
        leading={<Avatar name="#" size="sm" />}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <StyledView className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4a65e8" />
        </StyledView>
      ) : (
        <StyledView className="flex-1">
          <MessageList
            messages={messages ?? []}
            currentProfileId={profileId}
            onLoadMore={loadMore}
          />
          <TypingIndicator typingUsers={[]} />
          <MessageInput onSend={handleSend} />
        </StyledView>
      )}
    </SafeAreaView>
  );
}
