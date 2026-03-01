import { notFound } from 'next/navigation';
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
import { buildChannelById } from '@iconicedu/web/lib/channels/builders/channel.builder';
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
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { profileResponse, currentUserProfile } = await getDashboardProfileContext(
    supabase,
    account.id,
  );
  const channel = await buildChannelById(supabase, account.org_id, channelId, {
    accountId: account.id,
    profileId: profileResponse.data?.id ?? null,
    messagesLimit: INITIAL_MESSAGES_PAGE_SIZE,
  });

  if (!channel) {
    notFound();
  }
  const isStaffReadOnly = isStaffObserverReadOnlyChannel(channel, account.id, currentUserProfile);

  return (
    <div className="flex h-[calc(100vh-1.0rem)] flex-col">
      <DashboardHeader />
      <MessagesShellClient
        channel={channel}
        currentUserId={profileResponse.data?.id ?? ''}
        currentUserProfile={currentUserProfile}
        readOnly={isStaffReadOnly}
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
