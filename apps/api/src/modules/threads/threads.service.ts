import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

@Injectable()
export class ThreadsService {
  async get(
    accessToken: string,
    input: { orgId: string; channelId: string; threadId: string; accountId?: string },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const [
      { data: threads, error: threadError },
      { data: participants, error: participantsError },
      { data: readState, error: readStateError },
    ] = await Promise.all([
      supabase
        .from('threads')
        .select(
          'id, org_id, channel_id, parent_message_id, snippet, author_id, author_name, message_count, last_reply_at, created_at',
        )
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .eq('id', input.threadId)
        .maybeSingle(),
      supabase
        .from('thread_participants')
        .select(
          'thread_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, kind, timezone, ui_theme_key)',
        )
        .eq('org_id', input.orgId)
        .eq('thread_id', input.threadId)
        .is('deleted_at', null),
      supabase
        .from('channel_read_state')
        .select('thread_id, channel_id, last_read_message_id, last_read_at, unread_count')
        .eq('org_id', input.orgId)
        .eq('thread_id', input.threadId)
        .eq('account_id', input.accountId ?? '')
        .is('deleted_at', null),
    ]);
    if (threadError) throw new InternalServerErrorException(threadError.message);
    if (participantsError)
      throw new InternalServerErrorException(participantsError.message);
    if (readStateError) throw new InternalServerErrorException(readStateError.message);
    return {
      thread: threads,
      participants: participants ?? [],
      readState: readState ?? [],
    };
  }

  async markRead(
    accessToken: string,
    input: {
      orgId: string;
      channelId: string;
      threadId: string;
      accountId: string;
      profileId: string;
      lastReadMessageId?: string | null;
    },
  ) {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const serviceSupabase = createSupabaseServiceClient();

    const threadLookup = await sessionSupabase
      .from('threads')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('id', input.threadId)
      .eq('channel_id', input.channelId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (threadLookup.error)
      throw new InternalServerErrorException(threadLookup.error.message);
    if (!threadLookup.data) {
      return { unreadCount: 0 };
    }

    const participantLookup = await sessionSupabase
      .from('thread_participants')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('thread_id', input.threadId)
      .eq('profile_id', input.profileId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (participantLookup.error) {
      throw new InternalServerErrorException(participantLookup.error.message);
    }
    if (!participantLookup.data) {
      return { unreadCount: 0 };
    }

    if (input.lastReadMessageId) {
      const messageLookup = await serviceSupabase
        .from('messages')
        .select('id')
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .eq('thread_id', input.threadId)
        .eq('id', input.lastReadMessageId)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>();

      if (messageLookup.error) {
        throw new InternalServerErrorException(messageLookup.error.message);
      }
      if (!messageLookup.data) {
        return { unreadCount: 0 };
      }
    }

    const { data, error } = await serviceSupabase.rpc(
      'recompute_unread_for_account_thread',
      {
        p_org_id: input.orgId,
        p_channel_id: input.channelId,
        p_thread_id: input.threadId,
        p_account_id: input.accountId,
        p_last_read_message_id: input.lastReadMessageId ?? null,
        p_last_read_at: new Date().toISOString(),
        p_actor_profile_id: input.profileId,
      },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return { unreadCount: typeof data === 'number' ? data : 0 };
  }
}
