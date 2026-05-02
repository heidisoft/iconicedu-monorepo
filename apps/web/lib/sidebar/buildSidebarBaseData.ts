import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelVM, SidebarLeftDataVM } from '@iconicedu/shared-types';

import { buildLearningSpacesByOrg } from '../spaces/builders/learning-space.builder';
import {
  buildAllChannels,
  buildDirectMessageChannelsWithMessages,
} from '../channels/builders/channel.builder';
import { getChannelsByOrg } from '../channels/queries/channels.query';
import { syncClassRequestUnreadCount } from './class-request-unread';

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
  const activeLearningSpaces = learningSpaces.filter(
    (space) => space.basics?.status !== 'archived' && !space.lifecycle?.archivedAt,
  );
  const alertChannels = allChannels.filter((channel) =>
    isNonLearningSpaceAlertChannel(channel, accountId),
  );
  const classRequestChannels = allChannels.filter((channel) =>
    isClassRequestChannel(channel, accountId),
  );
  const primaryClassRequestChannel = classRequestChannels
    .slice()
    .sort(
      (left, right) =>
        new Date(right.lifecycle.createdAt).getTime() -
        new Date(left.lifecycle.createdAt).getTime(),
    )[0];

  const navSecondary = supportChannelId
    ? [
        {
          title: 'Live Support',
          url: `${dashboardBasePath}/c/${supportChannelId}`,
          icon: 'life-buoy' as const,
        },
      ]
    : [];

  return syncClassRequestUnreadCount({
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
          title: 'Notifications',
          url: `${dashboardBasePath}/notifications`,
          icon: 'notifications',
        },
        ...(classRequestChannels.length
          ? [
              {
                title: 'Class Requests',
                url: `${dashboardBasePath}/c/${primaryClassRequestChannel?.ids.id}`,
                icon: 'send' as const,
              },
            ]
          : []),
      ],
      navSecondary,
    },
    collections: {
      learningSpaces: activeLearningSpaces,
      directMessages,
      classRequestChannels,
      alertChannels,
    },
  });
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

function isClassRequestChannel(channel: ChannelVM, accountId: string): boolean {
  if (channel.basics.purpose !== 'chass-requests') {
    return false;
  }

  return (
    channel.basics.visibility === 'public' ||
    channel.collections.participants.some(
      (participant) => participant.ids.accountId === accountId,
    )
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
