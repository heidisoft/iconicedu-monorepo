import { notFound } from 'next/navigation';
import { DashboardHeader } from '@iconicedu/ui-web';
import { LearningSpaceShell } from '@iconicedu/web/app/(app)/[orgSlug]/spaces/[channelId]/learning-space-shell';
import { sendTextMessageAction, toggleMessageReactionAction, deleteMessageAction, toggleHiddenMessageAction } from '@iconicedu/web/app/actions/messages';
import { buildChannelById } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { isStaffObserverReadOnlyChannel } from '@iconicedu/web/lib/channels/read-only';
import { buildLearningSpaceByChannelId } from '@iconicedu/web/lib/spaces/builders/learning-space.builder';
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
    messagesLimit: INITIAL_MESSAGES_PAGE_SIZE,
  });
  const learningSpace = await buildLearningSpaceByChannelId(
    supabase,
    account.org_id,
    channelId,
  );

  if (!channel) {
    notFound();
  }
  const isStaffReadOnly = isStaffObserverReadOnlyChannel(channel, account.id, currentUserProfile);

  return (
    <div className="flex h-[calc(100vh-1.0rem)] flex-col">
      <DashboardHeader />
      <LearningSpaceShell
        channel={channel}
        learningSpace={learningSpace}
        currentUserId={profileResponse.data?.id ?? ''}
        currentUserProfile={currentUserProfile}
        readOnly={isStaffReadOnly}
        sendTextMessage={sendTextMessageAction}
        toggleReaction={toggleMessageReactionAction}
        deleteMessage={deleteMessageAction}
        toggleHiddenMessage={toggleHiddenMessageAction}
      />
    </div>
  );
}
