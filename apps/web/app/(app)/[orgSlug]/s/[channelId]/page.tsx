import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DashboardHeader } from '@iconicedu/ui-web';
import { LearningSpaceShell } from '@iconicedu/web/app/(app)/[orgSlug]/s/[channelId]/learning-space-shell';
import {
  sendFileMessageAction,
  sendFilesMessageAction,
  sendTextMessageAction,
  toggleMessageReactionAction,
  toggleSavedMessageAction,
  deleteMessageAction,
  toggleHiddenMessageAction,
} from '@iconicedu/web/app/actions/messages';
import { buildChannelById } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { isStaffObserverReadOnlyChannel } from '@iconicedu/web/lib/channels/read-only';
import { buildLearningSpaceByChannelId } from '@iconicedu/web/lib/spaces/builders/learning-space.builder';
import { LEARNING_SPACE_MESSAGES_SECTION_TITLE } from '@iconicedu/web/app/(app)/[orgSlug]/s/[channelId]/page.constants';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import {
  enableAnyVisibleClassSessionJoin,
  enableMessageTypeComposer,
} from '@iconicedu/web/flags';

const INITIAL_MESSAGES_PAGE_SIZE = 40;

export const metadata: Metadata = {
  title: 'Classroom',
  description:
    'Follow classroom updates, resources, and messages for this learning space.',
};

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
  const learningSpace = await buildLearningSpaceByChannelId(
    supabase,
    account.org_id,
    channelId,
  );

  if (!channel) {
    notFound();
  }
  const showCreateMessageTypeButton = await enableMessageTypeComposer.run({
    identify: { profileId: profileResponse.data?.id ?? null },
  });
  const anyVisibleJoinEnabled = await enableAnyVisibleClassSessionJoin.run({
    identify: { profileId: profileResponse.data?.id ?? null },
  });
  const isStaffReadOnly = isStaffObserverReadOnlyChannel(
    channel,
    account.id,
    currentUserProfile,
  );

  return (
    <div className="flex h-[calc(100vh-1.0rem)] flex-col">
      <DashboardHeader title={LEARNING_SPACE_MESSAGES_SECTION_TITLE} />
      <LearningSpaceShell
        orgSlug={orgSlug}
        channel={channel}
        learningSpace={learningSpace}
        currentUserId={profileResponse.data?.id ?? ''}
        currentUserProfile={currentUserProfile}
        readOnly={isStaffReadOnly}
        showCreateMessageTypeButton={showCreateMessageTypeButton}
        anyVisibleJoinEnabled={anyVisibleJoinEnabled}
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
