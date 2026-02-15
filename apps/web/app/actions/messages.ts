'use server';

import type {
  MessageSendTextInput,
  MessageToggleReactionInput,
  MessageVM,
} from '@iconicedu/shared-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { mapMessageRowToVM } from '@iconicedu/web/lib/messages/mappers/message.mapper';
import { buildThreadById } from '@iconicedu/web/lib/messages/builders/thread.builder';

export async function sendTextMessageAction(
  input: MessageSendTextInput,
): Promise<MessageVM> {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }
  if (input.senderProfileId !== profileResponse.data.id) {
    throw new Error('Invalid sender');
  }

  const now = new Date().toISOString();
  let threadId = input.threadId ?? null;
  let parentMessage: {
    id: string;
    org_id: string;
    channel_id: string;
    sender_profile_id: string;
    thread_id?: string | null;
    type: string;
  } | null = null;
  let threadCreated = false;

  if (input.threadParentId) {
    const parentResponse = await supabase
      .from('messages')
      .select('id, org_id, channel_id, sender_profile_id, thread_id, type')
      .eq('id', input.threadParentId)
      .maybeSingle<typeof parentMessage>();

    parentMessage = parentResponse.data ?? null;

    if (
      !parentMessage ||
      parentMessage.org_id !== accountResponse.data.org_id ||
      parentMessage.channel_id !== input.channelId
    ) {
      throw new Error('Parent message not found');
    }

    if (parentMessage.thread_id) {
      threadId = parentMessage.thread_id;
    } else if (threadId) {
      const threadLookup = await supabase
        .from('threads')
        .select('id, parent_message_id, channel_id, org_id')
        .eq('id', threadId)
        .maybeSingle<{
          id: string;
          parent_message_id: string | null;
          channel_id: string;
          org_id: string;
        }>();
      if (
        !threadLookup.data ||
        threadLookup.data.parent_message_id !== parentMessage.id ||
        threadLookup.data.channel_id !== input.channelId ||
        threadLookup.data.org_id !== accountResponse.data.org_id
      ) {
        threadId = null;
      }
    }

    if (!threadId) {
      const parentPayloadResponse = await supabase
        .from('message_text')
        .select('payload')
        .eq('message_id', parentMessage.id)
        .maybeSingle<{ payload: Record<string, unknown> | null }>();
      const snippet =
        typeof parentPayloadResponse.data?.payload?.text === 'string'
          ? parentPayloadResponse.data.payload.text
          : parentMessage.type;

      const parentSender = await buildUserProfileById(
        supabase,
        parentMessage.sender_profile_id,
      );

      const threadInsert = await supabase
        .from('threads')
        .insert({
          org_id: accountResponse.data.org_id,
          channel_id: input.channelId,
          parent_message_id: parentMessage.id,
          snippet: snippet?.slice(0, 140) ?? null,
          author_id: parentMessage.sender_profile_id,
          author_name: parentSender?.profile.displayName ?? null,
          message_count: 1,
          last_reply_at: now,
          created_at: now,
          created_by: profileResponse.data.id,
          updated_at: now,
          updated_by: profileResponse.data.id,
        })
        .select('id')
        .single();

      if (threadInsert.error || !threadInsert.data) {
        throw new Error(threadInsert.error?.message ?? 'Unable to create thread.');
      }

      threadId = threadInsert.data.id;
      threadCreated = true;

      const updateParent = await supabase
        .from('messages')
        .update({
          thread_id: threadId,
          thread_parent_id: parentMessage.id,
          updated_at: now,
          updated_by: profileResponse.data.id,
        })
        .eq('id', parentMessage.id);

      if (updateParent.error) {
        throw new Error(updateParent.error.message);
      }
    }

    if (threadId) {
      const channelMembersResponse = await supabase
        .from('channel_members')
        .select('profile_id')
        .eq('org_id', accountResponse.data.org_id)
        .eq('channel_id', input.channelId)
        .is('deleted_at', null);

      if (channelMembersResponse.error) {
        throw new Error(channelMembersResponse.error.message);
      }

      const participants = [
        ...(channelMembersResponse.data ?? []).map((member) => member.profile_id),
        parentMessage.sender_profile_id,
        profileResponse.data.id,
      ].filter(Boolean);
      const participantRows = Array.from(new Set(participants)).map((profileId) => ({
        org_id: accountResponse.data.org_id,
        thread_id: threadId as string,
        profile_id: profileId,
        created_at: now,
        created_by: profileResponse.data.id,
        updated_at: now,
        updated_by: profileResponse.data.id,
      }));

      const participantInsert = await supabase
        .from('thread_participants')
        .upsert(participantRows, { onConflict: 'org_id,thread_id,profile_id' });

      if (participantInsert.error) {
        throw new Error(participantInsert.error.message);
      }
    }
  }

  const messageInsert = await supabase
    .from('messages')
    .insert({
      org_id: accountResponse.data.org_id,
      channel_id: input.channelId,
      sender_profile_id: profileResponse.data.id,
      type: 'text',
      visibility_type: 'all',
      thread_id: threadId,
      thread_parent_id: input.threadParentId ?? null,
      created_at: now,
      created_by: profileResponse.data.id,
      updated_at: now,
      updated_by: profileResponse.data.id,
    })
    .select('*')
    .single();

  if (messageInsert.error || !messageInsert.data) {
    throw new Error(messageInsert.error?.message ?? 'Unable to create message.');
  }

  const payloadInsert = await supabase.from('message_text').insert({
    message_id: messageInsert.data.id,
    org_id: accountResponse.data.org_id,
    payload: { text: input.content },
    created_at: now,
    created_by: profileResponse.data.id,
    updated_at: now,
    updated_by: profileResponse.data.id,
  });

  if (payloadInsert.error) {
    await supabase.from('messages').delete().eq('id', messageInsert.data.id);
    throw new Error(payloadInsert.error.message);
  }

  if (threadId && !threadCreated) {
    const threadRow = await supabase
      .from('threads')
      .select('id, message_count')
      .eq('id', threadId)
      .maybeSingle<{ id: string; message_count: number | null }>();

    if (threadRow.data) {
      const updateThread = await supabase
        .from('threads')
        .update({
          message_count: (threadRow.data.message_count ?? 0) + 1,
          last_reply_at: now,
          updated_at: now,
          updated_by: profileResponse.data.id,
        })
        .eq('id', threadId);
      if (updateThread.error) {
        throw new Error(updateThread.error.message);
      }
    }
  }

  const sender = await buildUserProfileById(supabase, profileResponse.data.id);
  if (!sender) {
    throw new Error('Sender not found');
  }

  const thread = threadId
    ? await buildThreadById(supabase, accountResponse.data.org_id, threadId)
    : null;

  return mapMessageRowToVM(messageInsert.data, {
    sender,
    payload: { text: input.content },
    reactions: [],
    thread: thread ?? undefined,
  });
}

export async function toggleMessageReactionAction(
  input: MessageToggleReactionInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  if (!input.emoji?.trim()) {
    throw new Error('Emoji is required');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }

  const messageResponse = await supabase
    .from('messages')
    .select('id, org_id')
    .eq('id', input.messageId)
    .maybeSingle<{ id: string; org_id: string }>();

  if (!messageResponse.data || messageResponse.data.org_id !== input.orgId) {
    throw new Error('Message not found');
  }

  const reactionResponse = await supabase
    .from('message_reactions')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('message_id', input.messageId)
    .eq('account_id', accountResponse.data.id)
    .eq('emoji', input.emoji)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  const countResponse = await supabase
    .from('message_reaction_counts')
    .select('id, count')
    .eq('org_id', input.orgId)
    .eq('message_id', input.messageId)
    .eq('emoji', input.emoji)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; count: number }>();

  if (reactionResponse.data?.id) {
    const deleteReaction = await supabase
      .from('message_reactions')
      .delete()
      .eq('id', reactionResponse.data.id);

    if (deleteReaction.error) {
      throw new Error(deleteReaction.error.message);
    }

    if (countResponse.data) {
      if (countResponse.data.count <= 1) {
        const deleteCount = await supabase
          .from('message_reaction_counts')
          .delete()
          .eq('id', countResponse.data.id);
        if (deleteCount.error) {
          throw new Error(deleteCount.error.message);
        }
      } else {
        const updateCount = await supabase
          .from('message_reaction_counts')
          .update({ count: countResponse.data.count - 1 })
          .eq('id', countResponse.data.id);
        if (updateCount.error) {
          throw new Error(updateCount.error.message);
        }
      }
    }

    return;
  }

  const now = new Date().toISOString();
  const insertReaction = await supabase.from('message_reactions').insert({
    org_id: input.orgId,
    message_id: input.messageId,
    account_id: accountResponse.data.id,
    emoji: input.emoji,
    created_at: now,
    updated_at: now,
  });

  if (insertReaction.error) {
    throw new Error(insertReaction.error.message);
  }

  if (countResponse.data) {
    const updateCount = await supabase
      .from('message_reaction_counts')
      .update({ count: countResponse.data.count + 1 })
      .eq('id', countResponse.data.id);
    if (updateCount.error) {
      throw new Error(updateCount.error.message);
    }
    return;
  }

  const insertCount = await supabase.from('message_reaction_counts').insert({
    org_id: input.orgId,
    message_id: input.messageId,
    emoji: input.emoji,
    count: 1,
    created_at: now,
    updated_at: now,
  });

  if (insertCount.error) {
    throw new Error(insertCount.error.message);
  }
}

export async function deleteMessageAction(input: {
  messageId: string;
  orgId: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }

  const messageResponse = await supabase
    .from('messages')
    .select('id, org_id, sender_profile_id')
    .eq('id', input.messageId)
    .maybeSingle<{ id: string; org_id: string; sender_profile_id: string }>();

  if (!messageResponse.data || messageResponse.data.org_id !== input.orgId) {
    throw new Error('Message not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  if (messageResponse.data.sender_profile_id !== profileResponse.data.id) {
    throw new Error('Unauthorized: You can only delete your own messages');
  }

  const now = new Date().toISOString();

  const deleteResult = await supabase
    .from('messages')
    .update({
      deleted_at: now,
      deleted_by: profileResponse.data.id,
    })
    .eq('id', input.messageId);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }
}
