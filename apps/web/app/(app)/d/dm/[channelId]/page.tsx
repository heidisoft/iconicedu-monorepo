import { notFound, redirect } from 'next/navigation';
import { DashboardHeader } from '@iconicedu/ui-web';
import { sendTextMessageAction, toggleMessageReactionAction } from '@iconicedu/web/app/actions/messages';
import { MessagesShellClient } from '@iconicedu/web/app/(app)/d/messages/messages-shell-client';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import {
  getProfileByAccountId,
  getProfileById,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { ensureDirectMessageChannel } from '@iconicedu/web/lib/channels/actions/ensure-direct-message-channel';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import {
  buildChannelByDmKey,
  buildChannelById,
} from '@iconicedu/web/lib/channels/builders/channel.builder';

const INITIAL_MESSAGES_PAGE_SIZE = 40;

export default async function Page({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const { account } = await getOrCreateAccount(supabase, {
    orgId: ORG_ID,
    authUserId: authUser.id,
    authEmail: authUser.email ?? null,
  });
  const profileResponse = await getProfileByAccountId(supabase, account.id);
  const currentProfileId = profileResponse.data?.id ?? null;
  const currentUserProfile = profileResponse.data
    ? await buildUserProfileById(supabase, profileResponse.data.id)
    : null;
  const channel =
    (await buildChannelById(supabase, account.org_id, channelId, {
      accountId: account.id,
      messagesLimit: INITIAL_MESSAGES_PAGE_SIZE,
    })) ??
    (await buildChannelByDmKey(supabase, account.org_id, channelId, {
      accountId: account.id,
      messagesLimit: INITIAL_MESSAGES_PAGE_SIZE,
    }));

  if (!channel && currentProfileId) {
    const profileByIdResponse = await getProfileById(supabase, channelId);
    const dmProfile = profileByIdResponse.data;
    if (dmProfile && dmProfile.org_id === account.org_id) {
      const { channelId: resolvedChannelId } = await ensureDirectMessageChannel(
        supabase,
        account.org_id,
        currentProfileId,
        dmProfile.id,
      );
      redirect(`/d/dm/${resolvedChannelId}`);
    }
  }

  if (!channel) {
    notFound();
  }

  return (
    <div className="flex h-[calc(100vh-1.0rem)] flex-col">
      <DashboardHeader />
      <MessagesShellClient
        channel={channel}
        currentUserId={profileResponse.data?.id ?? ''}
        currentUserProfile={currentUserProfile}
        sendTextMessage={sendTextMessageAction}
        toggleReaction={toggleMessageReactionAction}
      />
    </div>
  );
}
