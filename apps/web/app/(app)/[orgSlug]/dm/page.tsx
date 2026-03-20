import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  buildChannelById,
  buildChannelByDmKey,
  buildDirectMessageChannelsWithMessages,
} from '@iconicedu/web/lib/channels/builders/channel.builder';
import { getProfileById } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { ensureDirectMessageChannel } from '@iconicedu/web/lib/channels/actions/ensure-direct-message-channel';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';

type DmPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ id?: string; channelId?: string; userId?: string }>;
};

export const metadata: Metadata = {
  title: 'Direct Messages',
  description: 'Open your direct messages and continue private conversations.',
};

export default async function Page({ params, searchParams }: DmPageProps) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { supabase, account, dashboardPath } = await getDashboardAccountContext(orgSlug);
  const { profileResponse } = await getDashboardProfileContext(supabase, account.id);
  const currentProfileId = profileResponse.data?.id ?? null;
  const requestedId =
    resolvedSearchParams?.channelId ??
    resolvedSearchParams?.userId ??
    resolvedSearchParams?.id ??
    null;
  let targetChannelId: string | null = null;

  if (requestedId) {
    const existingChannel = await buildChannelById(
      supabase,
      account.org_id,
      requestedId,
      { accountId: account.id },
    );
    if (existingChannel && ['dm', 'group_dm'].includes(existingChannel.basics.kind)) {
      targetChannelId = existingChannel.ids.id;
    } else if (currentProfileId) {
      const profileResponseById = await getProfileById(supabase, requestedId);
      const dmProfile = profileResponseById.data;
      if (dmProfile && dmProfile.org_id === account.org_id) {
        const dmKey = `dm:${[currentProfileId, dmProfile.id].sort().join('-')}`;
        const existingDm = await buildChannelByDmKey(supabase, account.org_id, dmKey, {
          accountId: account.id,
        });
        if (existingDm) {
          targetChannelId = existingDm.ids.id;
        } else {
          const { channelId } = await ensureDirectMessageChannel(
            supabase,
            account.org_id,
            currentProfileId,
            dmProfile.id,
          );
          targetChannelId = channelId;
        }
      }
    }
  }

  if (!targetChannelId) {
    const channels = await buildDirectMessageChannelsWithMessages(
      supabase,
      account.org_id,
      {
        accountId: account.id,
      },
    );
    const firstChannel = channels[0];

    if (!firstChannel) {
      return null;
    }

    targetChannelId = firstChannel.ids.id;
  }

  redirect(`${dashboardPath}/dm/${targetChannelId}`);
}
