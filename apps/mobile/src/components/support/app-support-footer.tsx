import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccount } from '@/hooks/use-account';
import { useSupportChannel } from '@/hooks/use-support-channel';
import { SupportFooter } from '@/components/support/support-footer';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { COMPONENT_HEIGHT, RADIUS, SPACING } from '@/lib/typography';

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
      <View
        style={{
          paddingHorizontal: SPACING[5] - SPACING[1] / 2,
          paddingTop: SPACING[5] - SPACING[1] / 2,
          paddingBottom: SPACING[4] - SPACING[1] / 2,
          gap: SPACING[3],
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <PulseBox width={96} height={SPACING[3]} radius={RADIUS.sm - SPACING[1] / 2} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <PulseBox
            width={140}
            height={COMPONENT_HEIGHT.btnSm - SPACING[2] + SPACING[1] / 2}
            radius={(COMPONENT_HEIGHT.btnSm - SPACING[2] + SPACING[1] / 2) / 2}
          />
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
