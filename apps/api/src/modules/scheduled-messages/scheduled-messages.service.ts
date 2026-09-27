import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { MessageMentionVM, ScheduledMessageVM } from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import {
  MessagesService,
  sanitizeMentions,
} from '@iconicedu/api/modules/messages/messages.service';

type ScheduledMessageRow = {
  id: string;
  org_id: string;
  channel_id: string;
  sender_profile_id: string;
  content: string;
  mentions: MessageMentionVM[] | null;
  thread_parent_id: string | null;
  thread_id: string | null;
  send_at: string;
  timezone: string | null;
  status: 'pending' | 'sent' | 'canceled' | 'failed';
  dispatched_message_id: string | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
};

function mapScheduledMessageRow(row: ScheduledMessageRow): ScheduledMessageVM {
  return {
    ids: { id: row.id, orgId: row.org_id },
    channelId: row.channel_id,
    senderProfileId: row.sender_profile_id,
    content: row.content,
    mentions: row.mentions ?? undefined,
    threadParentId: row.thread_parent_id,
    threadId: row.thread_id,
    sendAt: row.send_at,
    timezone: row.timezone,
    status: row.status,
    dispatchedMessageId: row.dispatched_message_id,
    lastError: row.last_error,
  };
}

const SCHEDULED_MESSAGE_SELECT =
  'id, org_id, channel_id, sender_profile_id, content, mentions, thread_parent_id, thread_id, send_at, timezone, status, dispatched_message_id, attempt_count, max_attempts, last_error';

@Injectable()
export class ScheduledMessagesService {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  constructor(private readonly messagesService: MessagesService) {}

  private async sanitizeMentionsForChannel(input: {
    serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
    orgId: string;
    channelId: string;
    content: string;
    mentions: MessageMentionVM[] | undefined;
    senderProfileId: string;
  }): Promise<MessageMentionVM[]> {
    if (!input.mentions?.length) return [];
    const channelMembersResponse = await input.serviceSupabase
      .from('channel_members')
      .select('profile_id')
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .is('deleted_at', null)
      .returns<Array<{ profile_id: string }>>();
    if (channelMembersResponse.error) {
      throw new InternalServerErrorException(channelMembersResponse.error.message);
    }
    return sanitizeMentions(
      input.content,
      input.mentions,
      new Set((channelMembersResponse.data ?? []).map((member) => member.profile_id)),
      input.senderProfileId,
    );
  }

  async create(
    authUserId: string,
    accessToken: string,
    input: {
      orgId: string;
      channelId: string;
      senderProfileId: string;
      content: string;
      mentions?: MessageMentionVM[];
      threadParentId?: string | null;
      threadId?: string | null;
      sendAt: string;
      timezone?: string | null;
    },
  ): Promise<ScheduledMessageVM> {
    const content = input.content.trim();
    if (!content) throw new BadRequestException('Message text is required');
    const sendAtMs = Date.parse(input.sendAt);
    if (Number.isNaN(sendAtMs))
      throw new BadRequestException('sendAt must be a valid date');
    if (sendAtMs <= Date.now()) {
      throw new BadRequestException('sendAt must be in the future');
    }

    const actor = await this.messagesService.resolveWritableProfile({
      authUserId,
      accessToken,
      orgId: input.orgId,
      senderProfileId: input.senderProfileId,
    });
    const serviceSupabase = createSupabaseServiceClient();
    const sanitizedMentions = await this.sanitizeMentionsForChannel({
      serviceSupabase,
      orgId: input.orgId,
      channelId: input.channelId,
      content,
      mentions: input.mentions,
      senderProfileId: actor.profile.id,
    });

    const now = new Date().toISOString();
    const { data, error } = await serviceSupabase
      .from('scheduled_messages')
      .insert({
        org_id: input.orgId,
        channel_id: input.channelId,
        sender_profile_id: actor.profile.id,
        content,
        mentions: sanitizedMentions,
        thread_parent_id: input.threadParentId ?? null,
        thread_id: input.threadId ?? null,
        send_at: input.sendAt,
        timezone: input.timezone ?? null,
        created_at: now,
        created_by: actor.profile.id,
        updated_at: now,
        updated_by: actor.profile.id,
      })
      .select(SCHEDULED_MESSAGE_SELECT)
      .single<ScheduledMessageRow>();
    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Unable to schedule message',
      );
    }
    return mapScheduledMessageRow(data);
  }

  private async requireOwnedPendingRow(
    accessToken: string,
    input: { orgId: string; id: string },
  ): Promise<ScheduledMessageRow> {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await sessionSupabase
      .from('scheduled_messages')
      .select(SCHEDULED_MESSAGE_SELECT)
      .eq('org_id', input.orgId)
      .eq('id', input.id)
      .is('deleted_at', null)
      .maybeSingle<ScheduledMessageRow>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Scheduled message not found');
    if (data.status !== 'pending') {
      throw new ForbiddenException('This message has already been sent or canceled');
    }
    return data;
  }

  async list(
    accessToken: string,
    input: { orgId: string; senderProfileId: string },
  ): Promise<ScheduledMessageVM[]> {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await sessionSupabase
      .from('scheduled_messages')
      .select(SCHEDULED_MESSAGE_SELECT)
      .eq('org_id', input.orgId)
      .eq('sender_profile_id', input.senderProfileId)
      .is('deleted_at', null)
      .in('status', ['pending', 'failed'])
      .order('send_at', { ascending: true })
      .returns<ScheduledMessageRow[]>();
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map(mapScheduledMessageRow);
  }

  async update(
    accessToken: string,
    input: {
      orgId: string;
      id: string;
      content?: string;
      mentions?: MessageMentionVM[];
      sendAt?: string;
      timezone?: string | null;
    },
  ): Promise<ScheduledMessageVM> {
    const existing = await this.requireOwnedPendingRow(accessToken, input);
    if (input.sendAt) {
      const sendAtMs = Date.parse(input.sendAt);
      if (Number.isNaN(sendAtMs))
        throw new BadRequestException('sendAt must be a valid date');
      if (sendAtMs <= Date.now()) {
        throw new BadRequestException('sendAt must be in the future');
      }
    }

    const serviceSupabase = createSupabaseServiceClient();
    const nextContent = input.content?.trim() ?? existing.content;
    if (!nextContent) throw new BadRequestException('Message text is required');

    const sanitizedMentions =
      input.mentions !== undefined
        ? await this.sanitizeMentionsForChannel({
            serviceSupabase,
            orgId: existing.org_id,
            channelId: existing.channel_id,
            content: nextContent,
            mentions: input.mentions,
            senderProfileId: existing.sender_profile_id,
          })
        : (existing.mentions ?? []);

    const now = new Date().toISOString();
    const { data, error } = await serviceSupabase
      .from('scheduled_messages')
      .update({
        content: nextContent,
        mentions: sanitizedMentions,
        send_at: input.sendAt ?? existing.send_at,
        timezone: input.timezone !== undefined ? input.timezone : existing.timezone,
        updated_at: now,
        updated_by: existing.sender_profile_id,
      })
      .eq('id', existing.id)
      .eq('status', 'pending')
      .select(SCHEDULED_MESSAGE_SELECT)
      .single<ScheduledMessageRow>();
    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Unable to update scheduled message',
      );
    }
    return mapScheduledMessageRow(data);
  }

  async cancel(accessToken: string, input: { orgId: string; id: string }): Promise<void> {
    const existing = await this.requireOwnedPendingRow(accessToken, input);
    const serviceSupabase = createSupabaseServiceClient();
    const { error } = await serviceSupabase
      .from('scheduled_messages')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('status', 'pending');
    if (error) throw new InternalServerErrorException(error.message);
  }

  async sendNow(
    accessToken: string,
    input: { orgId: string; id: string },
  ): Promise<ScheduledMessageVM> {
    const existing = await this.requireOwnedPendingRow(accessToken, input);
    const serviceSupabase = createSupabaseServiceClient();
    const result = await this.dispatchOne(serviceSupabase, existing);
    if (!result.ok) {
      throw new InternalServerErrorException(result.error);
    }
    return result.row;
  }

  /** Re-checks the sender still has access before actually creating the message — the issue explicitly requires this at delivery time, not just at schedule time. */
  private async dispatchOne(
    serviceSupabase: ReturnType<typeof createSupabaseServiceClient>,
    row: ScheduledMessageRow,
  ): Promise<{ ok: true; row: ScheduledMessageVM } | { ok: false; error: string }> {
    const now = new Date().toISOString();

    const senderResponse = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('id', row.sender_profile_id)
      .eq('org_id', row.org_id)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (senderResponse.error) {
      return { ok: false, error: senderResponse.error.message };
    }
    const membershipResponse = senderResponse.data
      ? await serviceSupabase
          .from('channel_members')
          .select('id')
          .eq('org_id', row.org_id)
          .eq('channel_id', row.channel_id)
          .eq('profile_id', row.sender_profile_id)
          .is('deleted_at', null)
          .maybeSingle<{ id: string }>()
      : { data: null, error: null };
    if (membershipResponse.error) {
      return { ok: false, error: membershipResponse.error.message };
    }
    if (!senderResponse.data || !membershipResponse.data) {
      await this.failRow(
        serviceSupabase,
        row,
        'Sender no longer has access to this channel',
      );
      return { ok: false, error: 'Sender no longer has access to this channel' };
    }

    const messageInsert = await serviceSupabase
      .from('messages')
      .insert({
        org_id: row.org_id,
        channel_id: row.channel_id,
        sender_profile_id: row.sender_profile_id,
        type: 'text',
        visibility_type: 'all',
        thread_id: row.thread_id,
        thread_parent_id: row.thread_parent_id,
        created_at: now,
        created_by: row.sender_profile_id,
        updated_at: now,
        updated_by: row.sender_profile_id,
      })
      .select('id')
      .single<{ id: string }>();
    if (messageInsert.error || !messageInsert.data) {
      await this.failRow(
        serviceSupabase,
        row,
        messageInsert.error?.message ?? 'Unable to create message',
      );
      return {
        ok: false,
        error: messageInsert.error?.message ?? 'Unable to create message',
      };
    }

    const payloadInsert = await serviceSupabase.from('message_text').insert({
      message_id: messageInsert.data.id,
      org_id: row.org_id,
      payload: {
        text: row.content,
        ...(row.mentions?.length ? { mentions: row.mentions } : {}),
      },
      created_at: now,
      created_by: row.sender_profile_id,
      updated_at: now,
      updated_by: row.sender_profile_id,
    });
    if (payloadInsert.error) {
      await serviceSupabase.from('messages').delete().eq('id', messageInsert.data.id);
      await this.failRow(serviceSupabase, row, payloadInsert.error.message);
      return { ok: false, error: payloadInsert.error.message };
    }

    const { data: updated, error: updateError } = await serviceSupabase
      .from('scheduled_messages')
      .update({
        status: 'sent',
        dispatched_message_id: messageInsert.data.id,
        updated_at: now,
      })
      .eq('id', row.id)
      .select(SCHEDULED_MESSAGE_SELECT)
      .single<ScheduledMessageRow>();
    if (updateError || !updated) {
      return {
        ok: false,
        error: updateError?.message ?? 'Message sent but scheduled row was not updated',
      };
    }
    return { ok: true, row: mapScheduledMessageRow(updated) };
  }

  private async failRow(
    serviceSupabase: ReturnType<typeof createSupabaseServiceClient>,
    row: ScheduledMessageRow,
    errorMessage: string,
  ) {
    const attemptCount = row.attempt_count + 1;
    const exhausted = attemptCount >= row.max_attempts;
    const { error } = await serviceSupabase
      .from('scheduled_messages')
      .update({
        status: exhausted ? 'failed' : 'pending',
        attempt_count: attemptCount,
        last_error: errorMessage,
        lease_owner: null,
        lease_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) {
      this.logger.error('Failed to record scheduled message failure', {
        scheduledMessageId: row.id,
        error: error.message,
      });
    }
  }

  /** Internal, service-role-only: claims and sends every due scheduled message. Called by the per-minute cron dispatch endpoint. */
  async dispatchDueScheduledMessages(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
  }): Promise<{ claimed: number; sent: number; failed: number }> {
    const serviceSupabase = createSupabaseServiceClient();
    const { data: claimed, error } = await serviceSupabase.rpc(
      'claim_due_scheduled_messages',
      {
        p_limit: input.limit ?? 25,
        p_lease_owner: input.leaseOwner,
        p_lease_seconds: input.leaseSeconds ?? 60,
      },
    );
    if (error) throw new InternalServerErrorException(error.message);

    const rows = (claimed ?? []) as ScheduledMessageRow[];
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      const result = await this.dispatchOne(serviceSupabase, row);
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        this.logger.warn('scheduled_message.dispatch_failed', {
          scheduledMessageId: row.id,
          error: result.error,
        });
      }
    }
    return { claimed: rows.length, sent, failed };
  }
}
