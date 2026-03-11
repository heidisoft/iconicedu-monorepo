import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelVM, SidebarLeftDataVM } from '@iconicedu/shared-types';

import { buildLearningSpacesByOrg } from '@iconicedu/web/lib/spaces/builders/learning-space.builder';
import {
  buildAllChannels,
  buildDirectMessageChannelsWithMessages,
} from '@iconicedu/web/lib/channels/builders/channel.builder';
import { getChannelsByOrg } from '@iconicedu/web/lib/channels/queries/channels.query';

type SidebarBaseData = Omit<SidebarLeftDataVM, 'user'>;

export async function buildSidebarBaseData(
  supabase: SupabaseClient,
  orgId: string,
  accountId: string,
  dashboardBasePath: string,
): Promise<SidebarBaseData> {
  const [learningSpaces, directMessages, allChannels, supportChannelId] =
    await Promise.all([
      buildLearningSpacesByOrg(supabase, orgId, { accountId }),
      buildDirectMessageChannelsWithMessages(supabase, orgId, { accountId }),
      buildAllChannels(supabase, orgId, { accountId }),
      resolveSupportChannelId(supabase, orgId),
    ]);
  const alertChannels = allChannels.filter((channel) =>
    isNonLearningSpaceAlertChannel(channel, accountId),
  );

  const navSecondary = supportChannelId
    ? [
        {
          title: 'Support',
          url: `${dashboardBasePath}/c/${supportChannelId}`,
          icon: 'life-buoy' as const,
        },
      ]
    : [];

  return {
    navigation: {
      navMain: [
        {
          title: 'Home',
          url: dashboardBasePath,
          icon: 'home',
        },
        {
          title: 'Calendar',
          url: `${dashboardBasePath}/class-schedule`,
          icon: 'class-schedule',
        },
        {
          title: 'Inbox',
          url: `${dashboardBasePath}/inbox`,
          icon: 'inbox',
        },
      ],
      navSecondary,
    },
    collections: {
      learningSpaces,
      directMessages,
      alertChannels,
    },
  };
}

function isNonLearningSpaceAlertChannel(channel: ChannelVM, accountId: string): boolean {
  if (channel.basics.purpose === 'learning-space') {
    return false;
  }
  if (channel.basics.visibility === 'public') {
    return true;
  }
  return channel.collections.participants.some(
    (participant) => participant.ids.accountId === accountId,
  );
}

async function resolveSupportChannelId(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  const response = await getChannelsByOrg(supabase, orgId);
  const channel = response.data?.find((row) => row.purpose === 'support');
  return channel?.id ?? null;
}
