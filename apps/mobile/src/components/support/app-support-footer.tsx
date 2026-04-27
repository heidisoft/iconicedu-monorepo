import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccount } from '@/hooks/use-account';
import { useSupportChannel } from '@/hooks/use-support-channel';
import { SupportFooter } from '@/components/support/support-footer';
import { PulseBox } from '@/components/skeletons/pulse-box';

export function AppSupportFooter({ isLoading = false }: { isLoading?: boolean }) {
  const router = useRouter();
  const { data: account } = useAccount();
  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const { data: supportChannel, isPending: supportLoading } = useSupportChannel(
    orgId ?? '',
  );

  if (isLoading || supportLoading) {
    return (
      <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, gap: 12 }}>
        <View style={{ alignItems: 'center' }}>
          <PulseBox width={96} height={12} radius={6} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <PulseBox width={140} height={38} radius={19} />
        </View>
      </View>
    );
  }

  if (!supportChannel?.id) return null;

  return (
    <SupportFooter
      onPress={() =>
        router.push({
          pathname: '/(app)/channel/[channelId]',
          params: {
            channelId: supportChannel.id,
            topic: supportChannel.topic ?? 'Live Support',
            iconKey: supportChannel.icon_key ?? 'life-buoy',
            themeKey: supportChannel.themeKey ?? '',
            messageUiThemeKey: supportChannel.messageUiThemeKey ?? 'feed',
            isLearningSpace: '0',
            purpose: 'support',
          },
        })
      }
    />
  );
}
