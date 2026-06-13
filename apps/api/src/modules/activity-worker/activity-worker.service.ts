import { Injectable } from '@nestjs/common';
import type {
  ActivitySourceJobKind,
  ActivitySourceJobRow,
  EventPipelineJobRow,
  MessageMentionVM,
} from '@iconicedu/shared-types';

import {
  publishReactionAddedActivity,
  publishTextMessagePostSendActivities,
  publishUnviewedClassroomMessageActivity,
  resolveActivityChannelContext,
  resolveVisibilityAudienceFromMessageRow,
} from '@iconicedu/api/lib/messages/message-activity';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import { type SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { resolveUnviewedMessageAlertThresholdHours } from '@iconicedu/api/lib/messages/unviewed-message-alert-config';

type MessageRow = {
  id: string;
  org_id: string;
  channel_id: string;
  sender_profile_id: string;
  type: string;
  visibility_type: string | null;
  visibility_user_id: string | null;
  visibility_user_ids: string[] | null;
  thread_id: string | null;
  thread_parent_id: string | null;
};

type MessagePayloadResolution = {
  content: string;
  mentions: MessageMentionVM[];
};

type LearningSpaceContext = {
  learningSpaceId: string;
  channelId: string;
  scheduleId: string;
  title: string;
  timezone: string | null;
  invitedMembers: Array<{
    profileId: string;
    name: string;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }>;
  firstSessionStartAt: string | null;
  firstSessionTimezone: string | null;
};

@Injectable()
export class ActivityWorkerService {
  async processEventPipelineGenerationJob(
    job: EventPipelineJobRow,
    supabase: SupabaseServiceClient,
  ) {
    const payload = job.payload ?? {};
    const rawSourceKind =
      typeof payload.sourceKind === 'string'
        ? payload.sourceKind
        : typeof payload.eventKind === 'string'
          ? payload.eventKind
          : job.source_kind;
    if (
      rawSourceKind !== 'message' &&
      rawSourceKind !== 'message_unviewed_check' &&
      rawSourceKind !== 'reaction' &&
      rawSourceKind !== 'session_cancel' &&
      rawSourceKind !== 'session_reschedule'
    ) {
      throw new Error(`Unsupported activity source job kind: ${String(rawSourceKind)}`);
    }

    if (rawSourceKind === 'message_unviewed_check') {
      const messageId =
        typeof payload.messageId === 'string'
          ? payload.messageId
          : typeof job.source_id === 'string'
            ? job.source_id
            : null;
      if (!messageId) {
        throw new Error('Missing messageId for message unviewed check job');
      }

      await publishUnviewedClassroomMessageActivity({
        supabase,
        orgId: job.org_id,
        messageId,
        now: new Date().toISOString(),
        thresholdHours:
          typeof payload.thresholdHours === 'number'
            ? payload.thresholdHours
            : resolveUnviewedMessageAlertThresholdHours(),
      });
      return;
    }

    const sourceKind: ActivitySourceJobKind = rawSourceKind;
    const sourceId =
      typeof payload.sourceId === 'string'
        ? payload.sourceId
        : typeof job.source_id === 'string'
          ? job.source_id
          : null;

    const sourceJob = {
      id: job.id,
      org_id: job.org_id,
      job_kind: sourceKind,
      message_id:
        sourceKind === 'message'
          ? typeof payload.messageId === 'string'
            ? payload.messageId
            : sourceId
          : null,
      reaction_id:
        sourceKind === 'reaction'
          ? typeof payload.reactionId === 'string'
            ? payload.reactionId
            : sourceId
          : null,
      exception_id:
        sourceKind === 'session_cancel'
          ? typeof payload.exceptionId === 'string'
            ? payload.exceptionId
            : sourceId
          : null,
      override_id:
        sourceKind === 'session_reschedule'
          ? typeof payload.overrideId === 'string'
            ? payload.overrideId
            : sourceId
          : null,
      dedupe_key: job.dedupe_key,
      status:
        job.status === 'pending' ||
        job.status === 'leased' ||
        job.status === 'succeeded' ||
        job.status === 'failed' ||
        job.status === 'dead_letter' ||
        job.status === 'canceled'
          ? job.status
          : 'failed',
      attempt_count: job.attempt_count,
      max_attempts: job.max_attempts,
      run_at: job.run_at,
      lease_owner: job.lease_owner,
      lease_until: job.lease_until,
      next_attempt_at: job.next_attempt_at,
      last_error: job.last_error,
      dispatched_at: job.dispatched_at,
      created_at: job.created_at,
      created_by: job.created_by,
      updated_at: job.updated_at,
      updated_by: job.updated_by,
      deleted_at: job.deleted_at,
      deleted_by: job.deleted_by,
    } satisfies ActivitySourceJobRow;

    await this.processSourceJobPayload(sourceJob, supabase);
  }

  private async processSourceJobPayload(
    job: ActivitySourceJobRow,
    supabase: SupabaseServiceClient,
  ) {
    if (job.job_kind === 'message') {
      await this.processMessageJob(job, supabase);
    } else if (job.job_kind === 'reaction') {
      await this.processReactionJob(job, supabase);
    } else if (job.job_kind === 'session_cancel') {
      await this.processSessionCancelJob(job, supabase);
    } else if (job.job_kind === 'session_reschedule') {
      await this.processSessionRescheduleJob(job, supabase);
    } else {
      throw new Error(`Unsupported activity source job kind: ${job.job_kind}`);
    }
  }

  private async processMessageJob(
    job: ActivitySourceJobRow,
    supabase: SupabaseServiceClient,
  ) {
    if (!job.message_id) {
      throw new Error('Missing message_id for message job');
    }

    const messageResponse = await supabase
      .from('messages')
      .select(
        'id, org_id, channel_id, sender_profile_id, type, visibility_type, visibility_user_id, visibility_user_ids, thread_id, thread_parent_id',
      )
      .eq('org_id', job.org_id)
      .eq('id', job.message_id)
      .is('deleted_at', null)
      .maybeSingle<MessageRow>();

    if (messageResponse.error) {
      throw new Error(messageResponse.error.message);
    }

    const message = messageResponse.data;
    if (!message) {
      throw new Error(`Message not found for activity job ${job.id}`);
    }

    const activityContext = await resolveActivityChannelContext({
      supabase,
      orgId: job.org_id,
      channelId: message.channel_id,
    });
    const visibilityAudience = resolveVisibilityAudienceFromMessageRow({
      visibilityType: message.visibility_type,
      visibilityUserId: message.visibility_user_id,
      visibilityUserIds: message.visibility_user_ids,
    });
    const payload = await this.resolveMessagePayload({
      supabase,
      orgId: job.org_id,
      messageId: message.id,
      type: message.type,
    });

    await publishTextMessagePostSendActivities({
      supabase,
      orgId: job.org_id,
      channelId: message.channel_id,
      senderProfileId: message.sender_profile_id,
      messageId: message.id,
      content: payload.content,
      mentions: payload.mentions,
      threadId: message.thread_id,
      threadReply: Boolean(message.thread_parent_id),
      now: new Date().toISOString(),
      activityContext,
      visibilityAudience,
    });
  }

  private async processReactionJob(
    job: ActivitySourceJobRow,
    supabase: SupabaseServiceClient,
  ) {
    if (!job.reaction_id) {
      throw new Error('Missing reaction_id for reaction job');
    }

    const reactionResponse = await supabase
      .from('message_reactions')
      .select('id, org_id, message_id, account_id, emoji, created_by')
      .eq('org_id', job.org_id)
      .eq('id', job.reaction_id)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        org_id: string;
        message_id: string;
        account_id: string;
        emoji: string;
        created_by: string | null;
      }>();

    if (reactionResponse.error) {
      throw new Error(reactionResponse.error.message);
    }

    const reaction = reactionResponse.data;
    if (!reaction) {
      throw new Error(`Reaction not found for activity job ${job.id}`);
    }

    const messageResponse = await supabase
      .from('messages')
      .select('channel_id, sender_profile_id, type')
      .eq('org_id', job.org_id)
      .eq('id', reaction.message_id)
      .is('deleted_at', null)
      .maybeSingle<{
        channel_id: string | null;
        sender_profile_id: string | null;
        type: string | null;
      }>();

    if (messageResponse.error) {
      throw new Error(messageResponse.error.message);
    }

    const message = messageResponse.data;
    if (!message?.channel_id || !message.sender_profile_id) {
      throw new Error(`Message context missing for reaction job ${job.id}`);
    }

    const actorProfileId = await this.resolveReactionActorProfileId({
      supabase,
      orgId: job.org_id,
      reaction,
    });
    const messagePayload = await this.resolveMessagePayload({
      supabase,
      orgId: job.org_id,
      messageId: reaction.message_id,
      type: message.type ?? 'text',
    });

    await publishReactionAddedActivity({
      supabase,
      orgId: job.org_id,
      channelId: message.channel_id,
      senderProfileId: actorProfileId,
      messageId: reaction.message_id,
      messageSenderProfileId: message.sender_profile_id,
      messagePreview: messagePayload.content,
      emoji: reaction.emoji,
      now: new Date().toISOString(),
    });
  }

  private async resolveReactionActorProfileId(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    reaction: {
      account_id: string;
      created_by: string | null;
    };
  }) {
    if (input.reaction.created_by) {
      return input.reaction.created_by;
    }

    const profileResponse = await input.supabase
      .from('profiles')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('account_id', input.reaction.account_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (profileResponse.error) {
      throw new Error(profileResponse.error.message);
    }
    if (!profileResponse.data?.id) {
      throw new Error(
        `Reaction actor profile not found for account ${input.reaction.account_id}`,
      );
    }

    return profileResponse.data.id;
  }

  private async processSessionCancelJob(
    job: ActivitySourceJobRow,
    supabase: SupabaseServiceClient,
  ) {
    if (!job.exception_id) {
      throw new Error('Missing exception_id for session cancel job');
    }

    const exceptionResponse = await supabase
      .from('class_schedule_recurrence_exceptions')
      .select(
        'id, recurrence_id, occurrence_key, reason, suppress_notifications, created_by, updated_by',
      )
      .eq('org_id', job.org_id)
      .eq('id', job.exception_id)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        recurrence_id: string;
        occurrence_key: string;
        reason: string | null;
        suppress_notifications?: boolean | null;
        created_by?: string | null;
        updated_by?: string | null;
      }>();

    if (exceptionResponse.error) {
      throw new Error(exceptionResponse.error.message);
    }
    const exception = exceptionResponse.data;
    if (!exception) {
      throw new Error(`Schedule exception not found for activity job ${job.id}`);
    }

    const context = await this.resolveLearningSpaceContextFromRecurrence({
      supabase,
      orgId: job.org_id,
      recurrenceId: exception.recurrence_id,
    });
    const actorProfileId = await this.resolveScheduleActorProfileId({
      supabase,
      orgId: job.org_id,
      actorRef:
        exception.updated_by ??
        exception.created_by ??
        job.updated_by ??
        job.created_by ??
        null,
    });

    await publishActivityEvent({
      supabase,
      orgId: job.org_id,
      eventType: 'class.session.canceled',
      sourceKind: actorProfileId ? 'profile' : 'system',
      actorProfileId,
      scope: { kind: 'learning_space', learningSpaceId: context.learningSpaceId },
      objectRef: { kind: 'session', id: exception.occurrence_key },
      targetRef: { kind: 'learning_space', id: context.learningSpaceId },
      audienceRules: [{ kind: 'all_in_scope' }],
      payload: {
        learningSpaceId: context.learningSpaceId,
        channelId: context.channelId,
        scheduleId: context.scheduleId,
        title: context.title,
        learningSpaceTitle: context.title,
        channelRouteKind: 'space',
        startAt: exception.occurrence_key,
        occurrenceStart: exception.occurrence_key,
        canceledStartAt: exception.occurrence_key,
        canceledReason: exception.reason ?? null,
        reason: exception.reason ?? null,
        timezone: context.timezone,
        firstSessionStartAt: context.firstSessionStartAt,
        firstSessionTimezone: context.firstSessionTimezone,
        members: context.invitedMembers,
        suppressNotifications: exception.suppress_notifications === true,
      },
      dedupeKey: `class.session.canceled:${job.org_id}:${exception.id}`,
      refreshOnDedupe: true,
      createdBy: actorProfileId,
    });
  }

  private async processSessionRescheduleJob(
    job: ActivitySourceJobRow,
    supabase: SupabaseServiceClient,
  ) {
    if (!job.override_id) {
      throw new Error('Missing override_id for session reschedule job');
    }

    const overrideResponse = await supabase
      .from('class_schedule_recurrence_overrides')
      .select(
        'id, recurrence_id, occurrence_key, patch, suppress_notifications, created_by, updated_by',
      )
      .eq('org_id', job.org_id)
      .eq('id', job.override_id)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        recurrence_id: string;
        occurrence_key: string;
        patch: Record<string, unknown> | null;
        suppress_notifications?: boolean | null;
        created_by?: string | null;
        updated_by?: string | null;
      }>();

    if (overrideResponse.error) {
      throw new Error(overrideResponse.error.message);
    }
    const override = overrideResponse.data;
    if (!override) {
      throw new Error(`Schedule override not found for activity job ${job.id}`);
    }

    const context = await this.resolveLearningSpaceContextFromRecurrence({
      supabase,
      orgId: job.org_id,
      recurrenceId: override.recurrence_id,
    });
    const actorProfileId = await this.resolveScheduleActorProfileId({
      supabase,
      orgId: job.org_id,
      actorRef:
        override.updated_by ??
        override.created_by ??
        job.updated_by ??
        job.created_by ??
        null,
    });
    const patch = override.patch ?? {};
    const newStartAt =
      typeof patch.startAt === 'string' ? patch.startAt : override.occurrence_key;
    const newEndAt = typeof patch.endAt === 'string' ? patch.endAt : null;
    const reason = typeof patch.reason === 'string' ? patch.reason : null;

    await publishActivityEvent({
      supabase,
      orgId: job.org_id,
      eventType: 'class.session.rescheduled',
      sourceKind: actorProfileId ? 'profile' : 'system',
      actorProfileId,
      scope: { kind: 'learning_space', learningSpaceId: context.learningSpaceId },
      objectRef: { kind: 'session', id: override.occurrence_key },
      targetRef: { kind: 'learning_space', id: context.learningSpaceId },
      audienceRules: [{ kind: 'all_in_scope' }],
      payload: {
        learningSpaceId: context.learningSpaceId,
        channelId: context.channelId,
        scheduleId: context.scheduleId,
        title: context.title,
        learningSpaceTitle: context.title,
        channelRouteKind: 'space',
        startAt: newStartAt,
        endAt: newEndAt,
        occurrenceStart: override.occurrence_key,
        rescheduledFromStartAt: override.occurrence_key,
        rescheduledToStartAt: newStartAt,
        rescheduledReason: reason,
        reason,
        timezone: context.timezone,
        firstSessionStartAt: context.firstSessionStartAt,
        firstSessionTimezone: context.firstSessionTimezone,
        members: context.invitedMembers,
        suppressNotifications: override.suppress_notifications === true,
      },
      dedupeKey: `class.session.rescheduled:${job.org_id}:${override.id}`,
      refreshOnDedupe: true,
      createdBy: actorProfileId,
    });
  }

  private async resolveScheduleActorProfileId(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    actorRef: string | null;
  }) {
    if (!input.actorRef) {
      return null;
    }

    const profileByIdResponse = await input.supabase
      .from('profiles')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('id', input.actorRef)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (profileByIdResponse.error) {
      throw new Error(profileByIdResponse.error.message);
    }
    if (profileByIdResponse.data?.id) {
      return profileByIdResponse.data.id;
    }

    const profileByAccountResponse = await input.supabase
      .from('profiles')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('account_id', input.actorRef)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (profileByAccountResponse.error) {
      throw new Error(profileByAccountResponse.error.message);
    }

    return profileByAccountResponse.data?.id ?? null;
  }

  private async resolveLearningSpaceContextFromRecurrence(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    recurrenceId: string;
  }): Promise<LearningSpaceContext> {
    const recurrenceResponse = await input.supabase
      .from('class_schedule_recurrence')
      .select('schedule_id')
      .eq('org_id', input.orgId)
      .eq('id', input.recurrenceId)
      .is('deleted_at', null)
      .maybeSingle<{ schedule_id: string }>();

    if (recurrenceResponse.error) {
      throw new Error(recurrenceResponse.error.message);
    }
    if (!recurrenceResponse.data?.schedule_id) {
      throw new Error(`Schedule recurrence not found for ${input.recurrenceId}`);
    }

    const scheduleResponse = await input.supabase
      .from('class_schedules')
      .select(
        'id, title, start_at, timezone, source_learning_space_id, source_channel_id',
      )
      .eq('org_id', input.orgId)
      .eq('id', recurrenceResponse.data.schedule_id)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        title: string;
        start_at: string;
        timezone: string | null;
        source_learning_space_id: string | null;
        source_channel_id: string | null;
      }>();

    if (scheduleResponse.error) {
      throw new Error(scheduleResponse.error.message);
    }

    const schedule = scheduleResponse.data;
    if (!schedule?.source_learning_space_id || !schedule.source_channel_id) {
      throw new Error(
        `Learning space schedule context missing for ${input.recurrenceId}`,
      );
    }

    const participantsResponse = await input.supabase
      .from('learning_space_participants')
      .select('profile_id')
      .eq('org_id', input.orgId)
      .eq('learning_space_id', schedule.source_learning_space_id)
      .is('deleted_at', null)
      .returns<Array<{ profile_id: string }>>();

    if (participantsResponse.error) {
      throw new Error(participantsResponse.error.message);
    }

    const profileIds = (participantsResponse.data ?? []).map((row) => row.profile_id);
    const invitedMembers = await this.loadProfileSummaries({
      supabase: input.supabase,
      orgId: input.orgId,
      profileIds,
    });

    return {
      learningSpaceId: schedule.source_learning_space_id,
      channelId: schedule.source_channel_id,
      scheduleId: schedule.id,
      title: schedule.title,
      timezone: schedule.timezone,
      invitedMembers,
      firstSessionStartAt: schedule.start_at,
      firstSessionTimezone: schedule.timezone,
    };
  }

  private async loadProfileSummaries(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    profileIds: string[];
  }) {
    const uniqueIds = Array.from(new Set(input.profileIds.filter(Boolean)));
    if (!uniqueIds.length) {
      return [] as LearningSpaceContext['invitedMembers'];
    }

    const profilesResponse = await input.supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name, avatar_url, ui_theme_key')
      .eq('org_id', input.orgId)
      .in('id', uniqueIds)
      .is('deleted_at', null)
      .returns<
        Array<{
          id: string;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          ui_theme_key: string | null;
        }>
      >();

    if (profilesResponse.error) {
      throw new Error(profilesResponse.error.message);
    }

    const profileById = new Map(
      (profilesResponse.data ?? []).map((row) => [row.id, row]),
    );
    return uniqueIds.map((profileId) => {
      const profile = profileById.get(profileId);
      const fullName = [profile?.first_name?.trim(), profile?.last_name?.trim()]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .trim();

      return {
        profileId,
        name: profile?.display_name?.trim() || fullName || 'Participant',
        avatarUrl: profile?.avatar_url ?? null,
        themeKey: profile?.ui_theme_key ?? null,
      };
    });
  }

  private async resolveMessagePayload(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    messageId: string;
    type: string;
  }): Promise<MessagePayloadResolution> {
    const fallback = { content: 'Sent a message', mentions: [] as MessageMentionVM[] };

    const sanitizeMentions = (value: unknown): MessageMentionVM[] => {
      if (!Array.isArray(value)) return [];
      return value.filter((entry): entry is MessageMentionVM => {
        if (!entry || typeof entry !== 'object') return false;
        const candidate = entry as MessageMentionVM;
        return typeof candidate.profileId === 'string';
      });
    };

    const resolveTextContent = (payload: Record<string, unknown> | null | undefined) => {
      const text =
        typeof payload?.text === 'string' && payload.text.trim().length > 0
          ? payload.text.trim()
          : null;
      if (text) return text;
      const title =
        typeof payload?.title === 'string' && payload.title.trim().length > 0
          ? payload.title.trim()
          : null;
      if (title) return title;
      const description =
        typeof payload?.description === 'string' && payload.description.trim().length > 0
          ? payload.description.trim()
          : null;
      return description ?? fallback.content;
    };

    const readPayload = async (table: string) => {
      const response = await input.supabase
        .from(table)
        .select('payload')
        .eq('org_id', input.orgId)
        .eq('message_id', input.messageId)
        .is('deleted_at', null)
        .maybeSingle<{ payload: Record<string, unknown> | null }>();

      if (response.error) throw new Error(response.error.message);
      return response.data?.payload ?? null;
    };

    if (input.type === 'text') {
      const payload = await readPayload('message_text');
      return {
        content: resolveTextContent(payload),
        mentions: sanitizeMentions(payload?.mentions),
      };
    }
    if (input.type === 'link-preview') {
      const payload = await readPayload('message_link_preview');
      return {
        content: resolveTextContent(payload),
        mentions: sanitizeMentions(payload?.mentions),
      };
    }
    if (input.type === 'lesson-assignment') {
      const payload = await readPayload('message_lesson_assignment');
      return {
        content: resolveTextContent(payload),
        mentions: [],
      };
    }
    if (input.type === 'image') {
      const payload = await readPayload('message_image');
      return {
        content: resolveTextContent(payload),
        mentions: [],
      };
    }
    if (input.type === 'file') {
      const payload = await readPayload('message_file');
      return {
        content: resolveTextContent(payload),
        mentions: [],
      };
    }
    if (input.type === 'audio-recording') {
      const payload = await readPayload('message_audio_recording');
      return {
        content: resolveTextContent(payload),
        mentions: [],
      };
    }

    return fallback;
  }
}
