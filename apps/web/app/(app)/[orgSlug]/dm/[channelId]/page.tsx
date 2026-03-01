import { notFound, redirect } from 'next/navigation';
import { DashboardHeader } from '@iconicedu/ui-web';
import {
  sendFileMessageAction,
  sendFilesMessageAction,
  sendTextMessageAction,
  toggleMessageReactionAction,
  toggleSavedMessageAction,
  deleteMessageAction,
  toggleHiddenMessageAction,
} from '@iconicedu/web/app/actions/messages';
import { MessagesShellClient } from '@iconicedu/web/app/(app)/[orgSlug]/messages/messages-shell-client';

import {
  getProfileById,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { ensureDirectMessageChannel } from '@iconicedu/web/lib/channels/actions/ensure-direct-message-channel';
import {
  buildChannelByDmKey,
  buildChannelById,
} from '@iconicedu/web/lib/channels/builders/channel.builder';
import { isStaffObserverReadOnlyChannel } from '@iconicedu/web/lib/channels/read-only';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';

const INITIAL_MESSAGES_PAGE_SIZE = 40;

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; channelId: string }>;
}) {
  const { orgSlug, channelId } = await params;
  const { supabase, account, dashboardPath } = await getDashboardAccountContext(orgSlug);
  const { profileResponse, currentUserProfile } = await getDashboardProfileContext(
    supabase,
    account.id,
  );
  const currentProfileId = profileResponse.data?.id ?? null;
  const channel =
    (await buildChannelById(supabase, account.org_id, channelId, {
      accountId: account.id,
      profileId: profileResponse.data?.id ?? null,
      messagesLimit: INITIAL_MESSAGES_PAGE_SIZE,
    })) ??
    (await buildChannelByDmKey(supabase, account.org_id, channelId, {
      accountId: account.id,
      profileId: profileResponse.data?.id ?? null,
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
        orgSlug={orgSlug}
        channel={channel}
        currentUserId={profileResponse.data?.id ?? ''}
        currentUserProfile={currentUserProfile}
        readOnly={isSupervisedReadOnly || isStaffReadOnly}
        sendTextMessage={sendTextMessageAction}
        sendFileMessage={sendFileMessageAction}
        sendFilesMessage={sendFilesMessageAction}
        toggleReaction={toggleMessageReactionAction}
        toggleSavedMessage={toggleSavedMessageAction}
        deleteMessage={deleteMessageAction}
        toggleHiddenMessage={toggleHiddenMessageAction}
      />
    </div>
  );
}
