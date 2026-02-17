import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import {
  buildChannelById,
  buildChannelByDmKey,
  buildDirectMessageChannelsWithMessages,
} from '@iconicedu/web/lib/channels/builders/channel.builder';
import {
  getProfileByAccountId,
  getProfileById,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { ensureDirectMessageChannel } from '@iconicedu/web/lib/channels/actions/ensure-direct-message-channel';

type DmPageProps = {
  searchParams?: Promise<{ id?: string; channelId?: string; userId?: string }>;
};

export default async function Page({ searchParams }: DmPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const { account } = await getOrCreateAccount(supabase, {
    orgId: ORG_ID,
    authUserId: authUser.id,
    authEmail: authUser.email ?? null,
  });
  const profileResponse = await getProfileByAccountId(supabase, account.id);
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

  redirect(`/d/dm/${targetChannelId}`);
}
