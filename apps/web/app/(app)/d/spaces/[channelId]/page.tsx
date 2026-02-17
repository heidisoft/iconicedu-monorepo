import { notFound } from 'next/navigation';
import { DashboardHeader } from '@iconicedu/ui-web';
import { LearningSpaceShell } from '@iconicedu/web/app/(app)/d/spaces/[channelId]/learning-space-shell';
import { sendTextMessageAction, toggleMessageReactionAction, deleteMessageAction, toggleHiddenMessageAction } from '@iconicedu/web/app/actions/messages';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import { buildChannelById } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { isStaffObserverReadOnlyChannel } from '@iconicedu/web/lib/channels/read-only';
import { buildLearningSpaceByChannelId } from '@iconicedu/web/lib/spaces/builders/learning-space.builder';

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
  const currentUserProfile = profileResponse.data
    ? await buildUserProfileById(supabase, profileResponse.data.id)
    : null;
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
