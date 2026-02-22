import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader, Avatar } from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { sendTextMessage } from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { DEMO_DM_MESSAGES, DEMO_PROFILE_ID } from '@/lib/dummy-messages';

export default function DmConversationScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const { data: account } = useAccount();
  const { colors } = useTheme();

  const profileId = account?.default_profile_id ?? DEMO_PROFILE_ID;
  const orgId = account?.org_id ?? '';

  // Using dummy data — real API data will be wired after adding a DB-row → MessageVM layer
  const messages = DEMO_DM_MESSAGES;

  const handleSend = useCallback(
    async (text: string) => {
      if (!channelId || !profileId || !orgId) return;
      await sendTextMessage(channelId, profileId, orgId, text);
    },
    [channelId, profileId, orgId],
  );

  if (!channelId) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.pageBg }} edges={['top']}>
      <ScreenHeader
        title="Direct Message"
        leading={<Avatar name="DM" size="sm" />}
        onBack={() => router.back()}
      />
      <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
        <MessageList
          messages={messages}
          currentProfileId={profileId}
        />
        <TypingIndicator typingUsers={[]} />
        <MessageInput onSend={handleSend} />
      </View>
    </SafeAreaView>
  );
}
