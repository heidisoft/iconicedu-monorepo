import React from 'react';
import { useRouter } from 'expo-router';
import { useAccount } from '@/hooks/use-account';
import { useSupportChannel } from '@/hooks/use-support-channel';
import { SupportFooter } from '@/components/support/support-footer';

export function AppSupportFooter() {
  const router = useRouter();
  const { data: account } = useAccount();
  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const { data: supportChannel } = useSupportChannel(orgId ?? '');

  if (!supportChannel?.id) return null;

  return (
    <SupportFooter
      onPress={() =>
        router.push({
          pathname: '/(app)/channel/[channelId]',
          params: {
            channelId: supportChannel.id,
            topic: supportChannel.topic ?? 'Live Support',
          },
        })
      }
    />
  );
}
