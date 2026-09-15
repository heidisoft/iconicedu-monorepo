import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelVM, SidebarLeftDataVM } from '@iconicedu/shared-types';

import { buildLearningSpacesSidebarProjection } from '../spaces/builders/learning-space.builder';
import { buildChannelsSidebarProjection } from '../channels/builders/channel-sidebar.builder';
import { syncClassRequestUnreadCount } from './class-request-unread';

type SidebarBaseData = Omit<SidebarLeftDataVM, 'user'>;

export async function buildSidebarBaseData(
  supabase: SupabaseClient,
  orgId: string,
  accountId: string,
  dashboardBasePath: string,
): Promise<SidebarBaseData> {
  // One bounded fetch of every org channel (metadata + participants + read state, no
  // per-channel thread/message/media/file fan-out) backs every collection below —
  // replacing what used to be three overlapping full-channel-graph rebuilds
  // (`buildAllChannels`, `buildDirectMessageChannelsWithMessages`,
  // `buildLearningSpacesByOrg`'s per-channel `buildChannelById` calls) plus a fourth,
  // separate `getChannelsByOrg` call just to find the support channel id.
  const allChannels = await buildChannelsSidebarProjection(supabase, orgId, {
    accountId,
  });
  const channelsById = new Map(allChannels.map((channel) => [channel.ids.id, channel]));

  const learningSpaces = await buildLearningSpacesSidebarProjection(
    supabase,
    orgId,
    channelsById,
  );
  const activeLearningSpaces = learningSpaces.filter(
    (space) => space.basics?.status !== 'archived' && !space.lifecycle?.archivedAt,
  );

  const directMessages = allChannels.filter(
    (channel) => isDirectMessageChannel(channel) && isParticipant(channel, accountId),
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

  const supportChannelId =
    allChannels.find((channel) => channel.basics.purpose === 'support')?.ids.id ?? null;

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

function isDirectMessageChannel(channel: ChannelVM): boolean {
  return channel.basics.kind === 'dm' || channel.basics.kind === 'group_dm';
}

function isParticipant(channel: ChannelVM, accountId: string): boolean {
  return channel.collections.participants.some(
    (participant) => participant.ids.accountId === accountId,
  );
}

function isNonLearningSpaceAlertChannel(channel: ChannelVM, accountId: string): boolean {
  if (channel.basics.purpose === 'learning-space') {
    return false;
  }
  if (channel.basics.visibility === 'public') {
    return true;
  }
  return isParticipant(channel, accountId);
}

function isClassRequestChannel(channel: ChannelVM, accountId: string): boolean {
  if (channel.basics.purpose !== 'chass-requests') {
    return false;
  }

  return channel.basics.visibility === 'public' || isParticipant(channel, accountId);
}
