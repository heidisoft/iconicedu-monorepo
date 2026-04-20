import { Injectable } from '@nestjs/common';
import type {
  ActivitySourceJobRow,
  FeedScopeVM,
  MessageMentionVM,
} from '@iconicedu/shared-types';
import { randomUUID } from 'crypto';

import { AnalyticsService } from '@iconicedu/api/analytics/analytics.service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import {
  publishReactionAddedActivity,
  publishTextMessagePostSendActivities,
  resolveActivityChannelContext,
  resolveVisibilityAudienceFromMessageRow,
} from '@iconicedu/api/lib/messages/message-activity';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';

const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_LEASE_SECONDS = 120;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 10 * 60_000;

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
  constructor(private readonly analytics: AnalyticsService) {}

  private getSupabase(): SupabaseServiceClient {
    return createSupabaseServiceClient();
  }

  async dispatchDuePendingJobs(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
  }) {
    const supabase = this.getSupabase();
    const runId = randomUUID();
    const startedAt = Date.now();

    const claimResponse = await supabase.rpc('claim_due_activity_source_jobs', {
      p_limit: input.limit ?? DEFAULT_JOB_LIMIT,
      p_lease_owner: input.leaseOwner,
      p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
    });

    if (claimResponse.error) {
      throw new Error(claimResponse.error.message);
    }

    const claimed = (claimResponse.data ?? []) as ActivitySourceJobRow[];
    let succeeded = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const job of claimed) {
      try {
        await this.processJob(job, supabase);
        succeeded += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryable =
          this.isRetryableError(error) && job.attempt_count + 1 < job.max_attempts;
        const now = new Date();
        const nextAttemptAt = new Date(
          now.getTime() + this.resolveRetryDelayMs(job.attempt_count + 1),
        ).toISOString();

        const response = await supabase
          .from('activity_source_jobs')
          .update({
            status: retryable ? 'failed' : 'dead_letter',
            attempt_count: job.attempt_count + 1,
            next_attempt_at: retryable ? nextAttemptAt : null,
            last_error: message,
            lease_owner: null,
            lease_until: null,
            updated_at: now.toISOString(),
          })
          .eq('id', job.id)
          .eq('org_id', job.org_id);

        if (response.error) {
          throw new Error(response.error.message);
        }

        this.analytics.capture('api activity source job failed', {
          jobId: job.id,
          orgId: job.org_id,
          jobKind: job.job_kind,
          attemptCount: job.attempt_count + 1,
          nextStatus: retryable ? 'failed' : 'dead_letter',
          errorMessage: message,
        });

        failed += 1;
        if (!retryable) deadLettered += 1;
      }
    }

    const durationMs = Date.now() - startedAt;
    this.analytics.capture('api activity worker dispatch completed', {
      runId,
      claimed: claimed.length,
      succeeded,
      failed,
      deadLettered,
      durationMs,
    });

    return {
      runId,
      claimed: claimed.length,
      succeeded,
      failed,
      deadLettered,
      durationMs,
    };
  }

  private resolveRetryDelayMs(attemptCount: number) {
    const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1);
    const jitter = Math.floor(Math.random() * 2_000);
    return Math.min(RETRY_MAX_MS, exponential + jitter);
  }

  private isRetryableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return !/invalid|unauthorized|forbidden|not found|missing/i.test(message);
  }

  private async processJob(job: ActivitySourceJobRow, supabase: SupabaseServiceClient) {
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

    const now = new Date().toISOString();
    const response = await supabase
      .from('activity_source_jobs')
      .update({
        status: 'succeeded',
        dispatched_at: now,
        lease_owner: null,
        lease_until: null,
        next_attempt_at: null,
        last_error: null,
        updated_at: now,
      })
      .eq('id', job.id)
      .eq('org_id', job.org_id);

    if (response.error) {
      throw new Error(response.error.message);
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
      .select('channel_id, sender_profile_id')
      .eq('org_id', job.org_id)
      .eq('id', reaction.message_id)
      .is('deleted_at', null)
      .maybeSingle<{ channel_id: string | null; sender_profile_id: string | null }>();

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

    await publishReactionAddedActivity({
      supabase,
      orgId: job.org_id,
      channelId: message.channel_id,
      senderProfileId: actorProfileId,
      messageId: reaction.message_id,
      messageSenderProfileId: message.sender_profile_id,
      emoji: reaction.emoji,
      now: new Date().toISOString(),
    });
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
      .select('id, recurrence_id, occurrence_key, reason, created_by')
      .eq('org_id', job.org_id)
      .eq('id', job.exception_id)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        recurrence_id: string;
        occurrence_key: string;
        reason: string | null;
        created_by: string | null;
      }>();

    if (exceptionResponse.error) {
      throw new Error(exceptionResponse.error.message);
    }

    const exception = exceptionResponse.data;
    if (!exception) {
      throw new Error(`Session exception not found for activity job ${job.id}`);
    }

    const context = await this.resolveLearningSpaceContextFromRecurrence({
      supabase,
      orgId: job.org_id,
      recurrenceId: exception.recurrence_id,
    });

    await publishActivityEvent({
      supabase,
      orgId: job.org_id,
      eventType: 'class.session.canceled',
      occurredAt: new Date().toISOString(),
      sourceKind: 'system',
      actorProfileId: exception.created_by,
      scope: { kind: 'learning_space', learningSpaceId: context.learningSpaceId },
      targetRef: { kind: 'learning_space', id: context.learningSpaceId },
      payload: {
        learningSpaceId: context.learningSpaceId,
        channelId: context.channelId,
        scheduleId: context.scheduleId,
        title: context.title,
        activityPhase: 'updated',
        invitedCount: context.invitedMembers.length,
        invitedMembers: context.invitedMembers,
        firstSessionStartAt: context.firstSessionStartAt,
        firstSessionTimezone: context.firstSessionTimezone,
        canceledStartAt: exception.occurrence_key,
        canceledReason: exception.reason ?? null,
        timezone: context.timezone ?? 'UTC',
      },
      dedupeKey: `session.canceled:${job.exception_id}`,
      createdBy: exception.created_by,
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
      .select('id, recurrence_id, occurrence_key, patch, created_by')
      .eq('org_id', job.org_id)
      .eq('id', job.override_id)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        recurrence_id: string;
        occurrence_key: string;
        patch: Record<string, unknown> | null;
        created_by: string | null;
      }>();

    if (overrideResponse.error) {
      throw new Error(overrideResponse.error.message);
    }

    const override = overrideResponse.data;
    if (!override) {
      throw new Error(`Session override not found for activity job ${job.id}`);
    }

    const patch = override.patch ?? {};
    const context = await this.resolveLearningSpaceContextFromRecurrence({
      supabase,
      orgId: job.org_id,
      recurrenceId: override.recurrence_id,
    });

    await publishActivityEvent({
      supabase,
      orgId: job.org_id,
      eventType: 'class.session.rescheduled',
      occurredAt: new Date().toISOString(),
      sourceKind: 'system',
      actorProfileId: override.created_by,
      scope: { kind: 'learning_space', learningSpaceId: context.learningSpaceId },
      targetRef: { kind: 'learning_space', id: context.learningSpaceId },
      payload: {
        learningSpaceId: context.learningSpaceId,
        channelId: context.channelId,
        scheduleId: context.scheduleId,
        title: context.title,
        activityPhase: 'updated',
        invitedCount: context.invitedMembers.length,
        invitedMembers: context.invitedMembers,
        firstSessionStartAt: context.firstSessionStartAt,
        firstSessionTimezone: context.firstSessionTimezone,
        rescheduledFromStartAt: override.occurrence_key,
        rescheduledToStartAt:
          typeof patch.startAt === 'string' && patch.startAt.trim().length > 0
            ? patch.startAt
            : override.occurrence_key,
        rescheduledReason:
          typeof patch.reason === 'string' && patch.reason.trim().length > 0
            ? patch.reason
            : null,
        timezone: context.timezone ?? 'UTC',
      },
      dedupeKey: `session.rescheduled:${job.override_id}`,
      createdBy: override.created_by,
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
