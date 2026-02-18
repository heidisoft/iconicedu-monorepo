import React, { useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader, Avatar, NAV_THEME } from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useMessages } from '@/hooks/use-messages';
import { sendTextMessage } from '@/lib/api/queries';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';

export default function SpaceDetailScreen() {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV_THEME.dark.background }} edges={['top']}>
      <ScreenHeader
        title="Learning Space"
        leading={<Avatar name="LS" size="sm" />}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={NAV_THEME.dark.primary} />
        </View>
      ) : (
        <View className="flex-1">
          <MessageList
            messages={messages ?? []}
            currentProfileId={profileId}
            onLoadMore={loadMore}
          />
          <MessageInput onSend={handleSend} />
        </View>
      )}
    </SafeAreaView>
  );
}
