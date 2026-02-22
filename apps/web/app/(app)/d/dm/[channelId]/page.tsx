import { notFound, redirect } from 'next/navigation';
import { DashboardHeader } from '@iconicedu/ui-web';
import { sendTextMessageAction, toggleMessageReactionAction, deleteMessageAction, toggleHiddenMessageAction } from '@iconicedu/web/app/actions/messages';
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
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import {
  buildChannelByDmKey,
  buildChannelById,
} from '@iconicedu/web/lib/channels/builders/channel.builder';
import { isStaffObserverReadOnlyChannel } from '@iconicedu/web/lib/channels/read-only';

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
  const dashboardPath = await resolveOrgDashboardPath(supabase, account.org_id);
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
      redirect(`${dashboardPath}/dm/${resolvedChannelId}`);
    }
  }

  if (!channel) {
    notFound();
  }

  const participantAccountIds = new Set(
    (channel.collections.participants ?? []).map((participant) => participant.ids.accountId),
  );
  const guardianChildAccountIds = new Set(
    currentUserProfile?.kind === 'guardian'
      ? (currentUserProfile.children?.items ?? []).map((child) => child.ids.accountId)
      : [],
  );
  const hasGuardianInChannel = participantAccountIds.has(account.id);
  const hasChildInChannel = Array.from(guardianChildAccountIds).some((childAccountId) =>
    participantAccountIds.has(childAccountId),
  );
  const isSupervisedReadOnly =
    currentUserProfile?.kind === 'guardian' &&
    (channel.basics.kind === 'dm' || channel.basics.kind === 'group_dm') &&
    !hasGuardianInChannel &&
    hasChildInChannel;
  const isStaffReadOnly = isStaffObserverReadOnlyChannel(channel, account.id, currentUserProfile);

  return (
    <div className="flex h-[calc(100vh-1.0rem)] flex-col">
      <DashboardHeader />
      <MessagesShellClient
        channel={channel}
        currentUserId={profileResponse.data?.id ?? ''}
        currentUserProfile={currentUserProfile}
        readOnly={isSupervisedReadOnly || isStaffReadOnly}
        sendTextMessage={sendTextMessageAction}
        toggleReaction={toggleMessageReactionAction}
        deleteMessage={deleteMessageAction}
        toggleHiddenMessage={toggleHiddenMessageAction}
      />
    </div>
  );
}
