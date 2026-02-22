import type { SupabaseClient } from '@supabase/supabase-js';
import type { SidebarLeftDataVM } from '@iconicedu/shared-types';

import { buildLearningSpacesByOrg } from '@iconicedu/web/lib/spaces/builders/learning-space.builder';
import { buildDirectMessageChannelsWithMessages } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { getChannelsByOrg } from '@iconicedu/web/lib/channels/queries/channels.query';

type SidebarBaseData = Omit<SidebarLeftDataVM, 'user'>;

export async function buildSidebarBaseData(
  supabase: SupabaseClient,
  orgId: string,
  accountId: string,
  dashboardBasePath: string,
): Promise<SidebarBaseData> {
  const [learningSpaces, directMessages, supportChannelId] = await Promise.all([
    buildLearningSpacesByOrg(supabase, orgId, { accountId }),
    buildDirectMessageChannelsWithMessages(supabase, orgId, { accountId }),
    resolveSupportChannelId(supabase, orgId),
  ]);

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
          title: 'Class schedule',
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
    },
  };
}

async function resolveSupportChannelId(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  const response = await getChannelsByOrg(supabase, orgId);
  const channel = response.data?.find((row) => row.purpose === 'support');
  return channel?.id ?? null;
}
