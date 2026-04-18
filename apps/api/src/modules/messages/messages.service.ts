import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  MessageVM,
  MessageSendFileInput,
  MessageSendFilesInput,
  MessageSendTextInput,
  ReactionVM,
  ThreadVM,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import {
  filterVisibleMessageRows,
  mapRowToMessageVM,
  type RawMessageRow,
  type RawSenderProfile,
  buildSenderProfile,
} from '@iconicedu/api/lib/mobile-data/message-mappers';

const BASE_MESSAGE_SELECT = `
  id, org_id, channel_id, sender_profile_id, visibility_type, visibility_user_ids, type, created_at, updated_at, thread_parent_id,
  sender:profiles!sender_profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, kind)
`;

const TYPE_TABLE: Record<string, string> = {
  text: 'message_text',
  image: 'message_image',
  file: 'message_file',
  'audio-recording': 'message_audio_recording',
  'link-preview': 'message_link_preview',
  'lesson-assignment': 'message_lesson_assignment',
  'homework-submission': 'message_homework_submission',
  'progress-update': 'message_progress_update',
  'event-reminder': 'message_event_reminder',
  'session-summary': 'message_session_summary',
  'session-complete': 'message_session_complete',
  'session-booking': 'message_session_booking',
  'payment-reminder': 'message_payment_reminder',
  'feedback-request': 'message_feedback_request',
};

type RawThreadRow = {
  id: string;
  org_id: string;
  channel_id: string;
  parent_message_id: string;
  snippet: string | null;
  author_id: string | null;
  author_name: string | null;
  message_count: number | null;
  last_reply_at: string | null;
  created_at: string;
};

type RawThreadParticipantRow = {
  thread_id: string;
  profile: RawSenderProfile | null;
};

type RawThreadReadStateRow = {
  thread_id: string;
  channel_id: string | null;
  last_read_message_id: string | null;
  last_read_at: string | null;
  unread_count: number | null;
};

type WritableProfileRow = {
  id: string;
  org_id: string;
  account_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  kind: string | null;
};

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  private async loadPayloads(
    accessToken: string,
    rows: Array<{ id: string; type: string }>,
  ): Promise<Map<string, Record<string, unknown>>> {
    const supabase = createSupabaseSessionClient(accessToken);
    const byType = new Map<string, string[]>();
    for (const row of rows) {
      const bucket = byType.get(row.type) ?? [];
      bucket.push(row.id);
      byType.set(row.type, bucket);
    }

    const payloadMap = new Map<string, Record<string, unknown>>();
    await Promise.all(
      Array.from(byType.entries()).map(async ([type, ids]) => {
        const table = TYPE_TABLE[type];
        if (!table) return;
        const { data, error } = await supabase
          .from(table)
          .select('message_id, payload')
          .in('message_id', ids)
          .is('deleted_at', null);
        if (error) throw error;
        for (const row of (data ?? []) as Array<{
          message_id: string;
          payload: Record<string, unknown>;
        }>) {
          payloadMap.set(row.message_id, row.payload);
        }
      }),
    );

    return payloadMap;
  }

  private async loadReactions(
    accessToken: string,
    messageIds: string[],
    currentAccountId: string,
  ): Promise<Map<string, ReactionVM[]>> {
    if (!messageIds.length) return new Map();
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, account_id')
      .in('message_id', messageIds)
      .is('deleted_at', null);
    if (error) throw error;

    const grouped = new Map<string, Array<{ emoji: string; account_id: string }>>();
    for (const row of (data ?? []) as Array<{
      message_id: string;
      emoji: string;
      account_id: string;
    }>) {
      const bucket = grouped.get(row.message_id) ?? [];
      bucket.push({ emoji: row.emoji, account_id: row.account_id });
      grouped.set(row.message_id, bucket);
    }

    const result = new Map<string, ReactionVM[]>();
    for (const [messageId, rawReactions] of grouped) {
      const byEmoji = new Map<string, string[]>();
      for (const reaction of rawReactions) {
        const accounts = byEmoji.get(reaction.emoji) ?? [];
        accounts.push(reaction.account_id);
        byEmoji.set(reaction.emoji, accounts);
      }
      result.set(
        messageId,
        Array.from(byEmoji.entries()).map(([emoji, accountIds]) => ({
          emoji,
          count: accountIds.length,
          reactedByMe: currentAccountId ? accountIds.includes(currentAccountId) : false,
          sampleUserIds: accountIds.slice(0, 5),
        })),
      );
    }

    return result;
  }

  private async loadThreads(
    accessToken: string,
    parentMessageIds: string[],
    currentAccountId?: string,
  ): Promise<Map<string, ThreadVM>> {
    if (!parentMessageIds.length) return new Map();
    const supabase = createSupabaseSessionClient(accessToken);

    const { data: threadRows, error: threadError } = await supabase
      .from('threads')
      .select(
        'id, org_id, channel_id, parent_message_id, snippet, author_id, author_name, message_count, last_reply_at, created_at',
      )
      .in('parent_message_id', parentMessageIds);
    if (threadError || !threadRows?.length) {
      return new Map();
    }

    const typedThreadRows = threadRows as RawThreadRow[];
    const threadIds = typedThreadRows.map((thread) => thread.id);
    const [
      { data: participantRows, error: participantError },
      { data: readStateRows, error: readStateError },
    ] = await Promise.all([
      supabase
        .from('thread_participants')
        .select(
          'thread_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, kind)',
        )
        .in('thread_id', threadIds)
        .is('deleted_at', null),
      currentAccountId
        ? supabase
            .from('thread_read_state')
            .select(
              'thread_id, channel_id, last_read_message_id, last_read_at, unread_count',
            )
            .eq('account_id', currentAccountId)
            .in('thread_id', threadIds)
            .is('deleted_at', null)
        : Promise.resolve({ data: [] as RawThreadReadStateRow[], error: null }),
    ]);
    if (participantError) throw participantError;
    if (readStateError) throw readStateError;

    const participantsByThread = new Map<string, RawSenderProfile[]>();
    for (const participant of (participantRows ??
      []) as unknown as RawThreadParticipantRow[]) {
      if (!participant.profile) continue;
      const list = participantsByThread.get(participant.thread_id) ?? [];
      list.push(participant.profile);
      participantsByThread.set(participant.thread_id, list);
    }

    const readStateByThread = new Map(
      ((readStateRows ?? []) as RawThreadReadStateRow[]).map((row) => [
        row.thread_id,
        {
          threadId: row.thread_id,
          channelId: row.channel_id ?? undefined,
          lastReadMessageId: row.last_read_message_id ?? undefined,
          lastReadAt: row.last_read_at ?? undefined,
          unreadCount: row.unread_count ?? undefined,
        },
      ]),
    );

    const result = new Map<string, ThreadVM>();
    for (const thread of typedThreadRows) {
      result.set(thread.parent_message_id, {
        ids: { id: thread.id, orgId: thread.org_id },
        parent: {
          messageId: thread.parent_message_id,
          snippet: thread.snippet ?? undefined,
          authorId: thread.author_id ?? undefined,
          authorName: thread.author_name ?? undefined,
        },
        stats: {
          messageCount: thread.message_count ?? 0,
          lastReplyAt: thread.last_reply_at ?? thread.created_at,
        },
        participants: (participantsByThread.get(thread.id) ?? []).map((profile) =>
          buildSenderProfile(profile, thread.org_id),
        ),
        readState:
          readStateByThread.get(thread.id) ??
          ({
            threadId: thread.id,
            channelId: thread.channel_id,
          } as ThreadVM['readState']),
      });
    }

    return result;
  }

  private async resolveWritableProfile(input: {
    authUserId: string;
    accessToken: string;
    orgId: string;
    senderProfileId: string;
  }) {
    const supabase = createSupabaseSessionClient(input.accessToken);

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, org_id')
      .eq('auth_user_id', input.authUserId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; org_id: string }>();
    if (accountError) throw new InternalServerErrorException(accountError.message);
    if (!account) throw new ForbiddenException('Account not found');

    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, org_id, account_id, display_name, first_name, last_name, avatar_url, avatar_seed, kind',
      )
      .eq('id', input.senderProfileId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .maybeSingle<WritableProfileRow>();
    if (profileError) throw new InternalServerErrorException(profileError.message);
    if (!senderProfile) throw new NotFoundException('Profile not found');

    if (senderProfile.account_id === account.id) {
      return { accountId: account.id, profile: senderProfile };
    }

    const { data: familyLink, error: familyLinkError } = await supabase
      .from('family_links')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('guardian_account_id', account.id)
      .eq('child_account_id', senderProfile.account_id)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (familyLinkError) throw new InternalServerErrorException(familyLinkError.message);
    if (!familyLink) {
      throw new ForbiddenException('Sender profile is not available to this account');
    }

    return { accountId: account.id, profile: senderProfile };
  }

  private async resolveThreadContext(input: {
    accessToken: string;
    orgId: string;
    channelId: string;
    currentProfile: WritableProfileRow;
    requestedThreadId?: string | null;
    threadParentId?: string | null;
    now: string;
  }): Promise<{ threadId: string | null; threadCreated: boolean }> {
    const sessionSupabase = createSupabaseSessionClient(input.accessToken);
    const serviceSupabase = createSupabaseServiceClient();
    let threadId = input.requestedThreadId ?? null;
    let threadCreated = false;

    if (!input.threadParentId) {
      return { threadId, threadCreated };
    }

    const parentResponse = await sessionSupabase
      .from('messages')
      .select('id, org_id, channel_id, sender_profile_id, thread_id, type')
      .eq('id', input.threadParentId)
      .maybeSingle<{
        id: string;
        org_id: string;
        channel_id: string;
        sender_profile_id: string;
        thread_id?: string | null;
        type: string;
      }>();
    if (parentResponse.error) {
      throw new InternalServerErrorException(parentResponse.error.message);
    }
    const parentMessage = parentResponse.data;
    if (
      !parentMessage ||
      parentMessage.org_id !== input.orgId ||
      parentMessage.channel_id !== input.channelId
    ) {
      throw new NotFoundException('Parent message not found');
    }

    if (parentMessage.thread_id) {
      threadId = parentMessage.thread_id;
    }

    if (!threadId) {
      const parentPayloadResponse = await sessionSupabase
        .from('message_text')
        .select('payload')
        .eq('message_id', parentMessage.id)
        .maybeSingle<{ payload: Record<string, unknown> | null }>();
      if (parentPayloadResponse.error) {
        throw new InternalServerErrorException(parentPayloadResponse.error.message);
      }
      const parentProfileResponse = await sessionSupabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('id', parentMessage.sender_profile_id)
        .is('deleted_at', null)
        .maybeSingle<{
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
        }>();
      if (parentProfileResponse.error) {
        throw new InternalServerErrorException(parentProfileResponse.error.message);
      }

      const snippet =
        typeof parentPayloadResponse.data?.payload?.text === 'string'
          ? parentPayloadResponse.data.payload.text
          : parentMessage.type;
      const authorName =
        parentProfileResponse.data?.display_name?.trim() ||
        [parentProfileResponse.data?.first_name, parentProfileResponse.data?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        null;

      const threadInsert = await serviceSupabase
        .from('threads')
        .insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          parent_message_id: parentMessage.id,
          snippet: snippet?.slice(0, 140) ?? null,
          author_id: parentMessage.sender_profile_id,
          author_name: authorName,
          message_count: 1,
          last_reply_at: input.now,
          created_at: input.now,
          created_by: input.currentProfile.id,
          updated_at: input.now,
          updated_by: input.currentProfile.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (threadInsert.error || !threadInsert.data) {
        throw new InternalServerErrorException(
          threadInsert.error?.message ?? 'Unable to create thread',
        );
      }

      threadId = threadInsert.data.id;
      threadCreated = true;

      const updateParent = await serviceSupabase
        .from('messages')
        .update({
          thread_id: threadId,
          updated_at: input.now,
          updated_by: input.currentProfile.id,
        })
        .eq('id', parentMessage.id);
      if (updateParent.error) {
        throw new InternalServerErrorException(updateParent.error.message);
      }
    }

    if (threadId) {
      const participantRows = Array.from(
        new Set([parentMessage.sender_profile_id, input.currentProfile.id]),
      ).map((profileId) => ({
        org_id: input.orgId,
        thread_id: threadId as string,
        profile_id: profileId,
        created_at: input.now,
        created_by: input.currentProfile.id,
        updated_at: input.now,
        updated_by: input.currentProfile.id,
      }));

      const participantInsert = await serviceSupabase
        .from('thread_participants')
        .upsert(participantRows, { onConflict: 'org_id,thread_id,profile_id' });
      if (participantInsert.error) {
        throw new InternalServerErrorException(participantInsert.error.message);
      }
    }

    return { threadId, threadCreated };
  }

  private async bumpThreadReplyCount(input: {
    accessToken: string;
    threadId: string | null;
    threadCreated: boolean;
    now: string;
    currentProfileId: string;
  }) {
    if (!input.threadId || input.threadCreated) {
      return;
    }

    const serviceSupabase = createSupabaseServiceClient();
    const threadRow = await serviceSupabase
      .from('threads')
      .select('id, message_count')
      .eq('id', input.threadId)
      .maybeSingle<{ id: string; message_count: number | null }>();
    if (threadRow.error) {
      throw new InternalServerErrorException(threadRow.error.message);
    }
    if (!threadRow.data) {
      return;
    }

    const updateThread = await serviceSupabase
      .from('threads')
      .update({
        message_count: (threadRow.data.message_count ?? 0) + 1,
        last_reply_at: input.now,
        updated_at: input.now,
        updated_by: input.currentProfileId,
      })
      .eq('id', input.threadId);
    if (updateThread.error) {
      throw new InternalServerErrorException(updateThread.error.message);
    }
  }

  async getChannelMessages(input: {
    accessToken: string;
    orgId: string;
    channelId: string;
    profileId: string;
    accountId: string;
    limit?: number;
    before?: string;
  }): Promise<MessageVM[]> {
    const supabase = createSupabaseSessionClient(input.accessToken);
    let query = supabase
      .from('messages')
      .select(BASE_MESSAGE_SELECT)
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .is('deleted_at', null)
      .is('thread_parent_id', null)
      .order('created_at', { ascending: false })
      .limit(input.limit ?? 40);

    if (input.before) {
      query = query.lt('created_at', input.before);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    const typedRows = filterVisibleMessageRows(
      (data ?? []) as unknown as RawMessageRow[],
      input.profileId,
    );
    if (!typedRows.length) return [];

    const messageIds = typedRows.map((row) => row.id);
    const [payloadMap, reactionMap, threadsMap] = await Promise.all([
      this.loadPayloads(input.accessToken, typedRows),
      this.loadReactions(input.accessToken, messageIds, input.accountId),
      this.loadThreads(input.accessToken, messageIds, input.accountId),
    ]);

    return [...typedRows]
      .reverse()
      .map((row) =>
        mapRowToMessageVM(
          row,
          payloadMap.get(row.id) ?? null,
          reactionMap.get(row.id) ?? [],
          threadsMap.get(row.id),
        ),
      );
  }

  async getThreadMessages(input: {
    accessToken: string;
    orgId: string;
    channelId: string;
    threadId: string;
    parentMessageId: string;
    profileId: string;
    accountId: string;
  }): Promise<MessageVM[]> {
    const supabase = createSupabaseSessionClient(input.accessToken);
    let { data: rows, error } = await supabase
      .from('messages')
      .select(BASE_MESSAGE_SELECT)
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .eq('thread_id', input.threadId)
      .neq('id', input.parentMessageId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!error && (!rows || rows.length === 0)) {
      ({ data: rows, error } = await supabase
        .from('messages')
        .select(BASE_MESSAGE_SELECT)
        .eq('org_id', input.orgId)
        .eq('channel_id', input.channelId)
        .eq('thread_parent_id', input.parentMessageId)
        .neq('id', input.parentMessageId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }));
    }

    if (error) throw new InternalServerErrorException(error.message);
    const typedRows = filterVisibleMessageRows(
      (rows ?? []) as unknown as RawMessageRow[],
      input.profileId,
    );
    if (!typedRows.length) return [];

    const messageIds = typedRows.map((row) => row.id);
    const [payloadMap, reactionMap] = await Promise.all([
      this.loadPayloads(input.accessToken, typedRows),
      this.loadReactions(input.accessToken, messageIds, input.accountId),
    ]);

    return typedRows.map((row) =>
      mapRowToMessageVM(
        row,
        payloadMap.get(row.id) ?? null,
        reactionMap.get(row.id) ?? [],
      ),
    );
  }

  async sendTextMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendTextInput,
  ) {
    try {
      const content = input.content.trim();
      if (!content) throw new BadRequestException('Message text is required');

      const actor = await this.resolveWritableProfile({
        authUserId,
        accessToken,
        orgId: input.orgId,
        senderProfileId: input.senderProfileId,
      });
      const serviceSupabase = createSupabaseServiceClient();
      const now = new Date().toISOString();
      const { threadId, threadCreated } = await this.resolveThreadContext({
        accessToken,
        orgId: input.orgId,
        channelId: input.channelId,
        currentProfile: actor.profile,
        requestedThreadId: input.threadId,
        threadParentId: input.threadParentId,
        now,
      });

      const messageInsert = await serviceSupabase
        .from('messages')
        .insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          sender_profile_id: actor.profile.id,
          type: 'text',
          thread_id: threadId,
          thread_parent_id: input.threadParentId ?? null,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (messageInsert.error || !messageInsert.data) {
        throw new InternalServerErrorException(
          messageInsert.error?.message ?? 'Unable to create message',
        );
      }

      const payloadInsert = await serviceSupabase.from('message_text').insert({
        message_id: messageInsert.data.id,
        org_id: input.orgId,
        payload: {
          text: content,
          ...(input.mentions?.length ? { mentions: input.mentions } : {}),
        },
        created_at: now,
        created_by: actor.profile.id,
        updated_at: now,
        updated_by: actor.profile.id,
      });
      if (payloadInsert.error) {
        throw new InternalServerErrorException(payloadInsert.error.message);
      }

      await this.bumpThreadReplyCount({
        accessToken,
        threadId,
        threadCreated,
        now,
        currentProfileId: actor.profile.id,
      });

      return { id: messageInsert.data.id };
    } catch (error) {
      this.logger.error('sendTextMessage failed', {
        error: error instanceof Error ? error.message : String(error),
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
      });
      throw error;
    }
  }

  async sendFileMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendFileInput,
  ) {
    try {
      if (!input.name?.trim()) throw new BadRequestException('File name is required');
      if (!input.storagePath?.trim()) {
        throw new BadRequestException('File storage path is required');
      }

      const actor = await this.resolveWritableProfile({
        authUserId,
        accessToken,
        orgId: input.orgId,
        senderProfileId: input.senderProfileId,
      });
      const serviceSupabase = createSupabaseServiceClient();
      const now = new Date().toISOString();
      const { threadId, threadCreated } = await this.resolveThreadContext({
        accessToken,
        orgId: input.orgId,
        channelId: input.channelId,
        currentProfile: actor.profile,
        requestedThreadId: input.threadId,
        threadParentId: input.threadParentId,
        now,
      });

      const isImageUpload = input.mimeType?.startsWith('image/') ?? false;
      const isAudioUpload = input.mimeType?.startsWith('audio/') ?? false;
      const messageType = isImageUpload
        ? 'image'
        : isAudioUpload
          ? 'audio-recording'
          : 'file';

      const messageInsert = await serviceSupabase
        .from('messages')
        .insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          sender_profile_id: actor.profile.id,
          type: messageType,
          thread_id: threadId,
          thread_parent_id: input.threadParentId ?? null,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (messageInsert.error || !messageInsert.data) {
        throw new InternalServerErrorException(
          messageInsert.error?.message ?? 'Unable to create message',
        );
      }

      const payload = {
        url: input.storagePath,
        storagePath: input.storagePath,
        name: input.name,
        size: input.size,
        mimeType: input.mimeType,
        durationSeconds: input.durationSeconds,
        ...(input.thumbnailUrl ? { thumbnailUrl: input.thumbnailUrl } : {}),
        ...(input.content?.trim() ? { text: input.content.trim() } : {}),
      };
      const payloadTable = isImageUpload
        ? 'message_image'
        : isAudioUpload
          ? 'message_audio_recording'
          : 'message_file';
      const payloadInsert = await serviceSupabase.from(payloadTable).insert({
        message_id: messageInsert.data.id,
        org_id: input.orgId,
        payload,
        created_at: now,
        created_by: actor.profile.id,
        updated_at: now,
        updated_by: actor.profile.id,
      });
      if (payloadInsert.error) {
        throw new InternalServerErrorException(payloadInsert.error.message);
      }

      if (isImageUpload) {
        const mediaInsert = await serviceSupabase.from('channel_media').insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          message_id: messageInsert.data.id,
          sender_profile_id: actor.profile.id,
          type: 'image',
          url: input.storagePath,
          name: input.name,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        });
        if (mediaInsert.error) {
          throw new InternalServerErrorException(mediaInsert.error.message);
        }
      } else if (!isAudioUpload) {
        const fileInsert = await serviceSupabase.from('channel_files').insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          message_id: messageInsert.data.id,
          sender_profile_id: actor.profile.id,
          kind: 'file',
          url: input.storagePath,
          name: input.name,
          mime_type: input.mimeType ?? null,
          size: input.size ?? null,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        });
        if (fileInsert.error) {
          throw new InternalServerErrorException(fileInsert.error.message);
        }
      }

      await this.bumpThreadReplyCount({
        accessToken,
        threadId,
        threadCreated,
        now,
        currentProfileId: actor.profile.id,
      });

      return { id: messageInsert.data.id };
    } catch (error) {
      this.logger.error('sendFileMessage failed', {
        error: error instanceof Error ? error.message : String(error),
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
      });
      throw error;
    }
  }

  async sendFilesMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendFilesInput,
  ) {
    try {
      if (!input.assets.length) {
        throw new BadRequestException('At least one file is required');
      }

      const actor = await this.resolveWritableProfile({
        authUserId,
        accessToken,
        orgId: input.orgId,
        senderProfileId: input.senderProfileId,
      });
      const serviceSupabase = createSupabaseServiceClient();
      const now = new Date().toISOString();
      const { threadId, threadCreated } = await this.resolveThreadContext({
        accessToken,
        orgId: input.orgId,
        channelId: input.channelId,
        currentProfile: actor.profile,
        requestedThreadId: input.threadId,
        threadParentId: input.threadParentId,
        now,
      });

      const allImages = input.assets.every((asset) =>
        asset.mimeType?.startsWith('image/'),
      );
      const messageType = allImages ? 'image' : 'file';
      const messageInsert = await serviceSupabase
        .from('messages')
        .insert({
          org_id: input.orgId,
          channel_id: input.channelId,
          sender_profile_id: actor.profile.id,
          type: messageType,
          thread_id: threadId,
          thread_parent_id: input.threadParentId ?? null,
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        })
        .select('id')
        .single<{ id: string }>();
      if (messageInsert.error || !messageInsert.data) {
        throw new InternalServerErrorException(
          messageInsert.error?.message ?? 'Unable to create message',
        );
      }

      const attachments = input.assets.map((asset) => ({
        url: asset.storagePath,
        storagePath: asset.storagePath,
        name: asset.name,
        size: asset.size,
        mimeType: asset.mimeType,
        ...(asset.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}),
      }));
      const payloadInsert = await serviceSupabase
        .from(allImages ? 'message_image' : 'message_file')
        .insert({
          message_id: messageInsert.data.id,
          org_id: input.orgId,
          payload: {
            attachments,
            ...(input.content?.trim() ? { text: input.content.trim() } : {}),
          },
          created_at: now,
          created_by: actor.profile.id,
          updated_at: now,
          updated_by: actor.profile.id,
        });
      if (payloadInsert.error) {
        throw new InternalServerErrorException(payloadInsert.error.message);
      }

      const assetTable = allImages ? 'channel_media' : 'channel_files';
      const assetRows = input.assets.map((asset) =>
        allImages
          ? {
              org_id: input.orgId,
              channel_id: input.channelId,
              message_id: messageInsert.data.id,
              sender_profile_id: actor.profile.id,
              type: 'image',
              url: asset.storagePath,
              name: asset.name,
              created_at: now,
              created_by: actor.profile.id,
              updated_at: now,
              updated_by: actor.profile.id,
            }
          : {
              org_id: input.orgId,
              channel_id: input.channelId,
              message_id: messageInsert.data.id,
              sender_profile_id: actor.profile.id,
              kind: 'file',
              url: asset.storagePath,
              name: asset.name,
              mime_type: asset.mimeType ?? null,
              size: asset.size ?? null,
              created_at: now,
              created_by: actor.profile.id,
              updated_at: now,
              updated_by: actor.profile.id,
            },
      );
      const assetInsert = await serviceSupabase.from(assetTable).insert(assetRows);
      if (assetInsert.error) {
        throw new InternalServerErrorException(assetInsert.error.message);
      }

      await this.bumpThreadReplyCount({
        accessToken,
        threadId,
        threadCreated,
        now,
        currentProfileId: actor.profile.id,
      });

      return { id: messageInsert.data.id };
    } catch (error) {
      this.logger.error('sendFilesMessage failed', {
        error: error instanceof Error ? error.message : String(error),
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
      });
      throw error;
    }
  }

  async deleteMessage(
    accessToken: string,
    messageId: string,
    body: { orgId: string; profileId: string },
  ) {
    if (!body.orgId || !body.profileId) {
      throw new BadRequestException('orgId and profileId are required');
    }

    const serviceSupabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const { error } = await serviceSupabase
      .from('messages')
      .update({
        deleted_at: now,
        deleted_by: body.profileId,
        updated_at: now,
        updated_by: body.profileId,
      })
      .eq('org_id', body.orgId)
      .eq('id', messageId);

    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
