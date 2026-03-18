import { NextResponse } from 'next/server';
import type { MessageRow } from '@iconicedu/shared-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { buildChannelFiles } from '@iconicedu/web/lib/messages/builders/channel-messages.builder';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';

type MessageVisibilityRow = Pick<
  MessageRow,
  | 'id'
  | 'sender_profile_id'
  | 'visibility_type'
  | 'visibility_user_id'
  | 'visibility_user_ids'
>;

function isMessageVisibleToProfile(
  message: MessageVisibilityRow,
  profileId: string,
): boolean {
  switch (message.visibility_type) {
    case 'sender-only':
      return message.sender_profile_id === profileId;
    case 'recipient-only':
      return (
        message.visibility_user_id === profileId ||
        message.sender_profile_id === profileId
      );
    case 'specific-users':
      return (
        (message.visibility_user_ids ?? []).includes(profileId) ||
        message.sender_profile_id === profileId
      );
    case 'all':
    default:
      return true;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  const files = await buildChannelFiles(supabase, accountResponse.data.org_id, channelId);
  const profileId =
    accountResponse.data.active_profile_id ??
    (await getProfileByAccountId(supabase, accountResponse.data.id)).data?.id ??
    null;

  if (!profileId) {
    return NextResponse.json({
      success: true,
      files,
    });
  }

  const messageIds = Array.from(
    new Set(
      files
        .map((file) => file.messageId)
        .filter((messageId): messageId is string => Boolean(messageId)),
    ),
  );

  if (!messageIds.length) {
    return NextResponse.json({
      success: true,
      files,
    });
  }

  const messageVisibilityResponse = await supabase
    .from('messages')
    .select(
      'id, sender_profile_id, visibility_type, visibility_user_id, visibility_user_ids',
    )
    .eq('org_id', accountResponse.data.org_id)
    .in('id', messageIds)
    .is('deleted_at', null)
    .returns<MessageVisibilityRow[]>();

  const messageVisibilityById = new Map(
    (messageVisibilityResponse.data ?? []).map((message) => [message.id, message]),
  );
  const visibleFiles = files.filter((file) => {
    if (!file.messageId) {
      return true;
    }
    const message = messageVisibilityById.get(file.messageId);
    if (!message) {
      return false;
    }
    return isMessageVisibleToProfile(message, profileId);
  });

  return NextResponse.json({
    success: true,
    files: visibleFiles,
  });
}
