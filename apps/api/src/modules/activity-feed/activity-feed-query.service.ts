import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  AdminActivityFeedAuditVM,
  AdminActivityFeedDeliveryChannelVM,
  AdminActivityFeedItemVM,
  AdminActivityFeedPipelineJobVM,
  AdminActivityFeedReminderJobVM,
  ActivityFeedVM,
  ActivityFeedItemVM,
  ActivityFeedSectionVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
  ActivityVerbVM,
  ActivityItemContentVM,
  ActivityItemAudienceVM,
  ActivityItemRefsVM,
  ActivityItemStateVM,
  ActivityFeedItemRow,
  ActivityFeedLeafItemVM,
  UserProfileVM,
  ChannelRow,
  EventPipelineJobRow,
  ProfileRow,
  ReminderDispatchLogRow,
  ReminderJobRow,
} from '@iconicedu/shared-types';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { buildSenderProfile } from '@iconicedu/api/lib/mobile-data/message-mappers';

const ACTIVITY_FEED_ITEM_SELECT = [
  'id',
  'org_id',
  'recipient_profile_id',
  'source_event_id',
  'kind',
  'occurred_at',
  'created_at',
  'tab_key',
  'audience',
  'verb',
  'actor_profile_id',
  'refs',
  'content',
  'summary',
  'preview',
  'action_button',
  'expanded_content',
  'importance',
  'is_read',
  'read_at',
  'dedupe_key',
  'metadata',
  'updated_at',
  'deleted_at',
].join(',');

const FEED_TABS: Array<{ key: InboxTabKeyVM; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'classes', label: 'Classes' },
  { key: 'payment', label: 'Payment' },
  { key: 'system', label: 'System' },
];

type RawActivityActorProfile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  kind?: string | null;
};

type RawClassSessionFeedbackRow = {
  source_event_id: string | null;
  message_id: string | null;
  class_session_id: string;
  classroom_id: string;
  channel_id: string;
  occurrence_start_at: string | null;
  rating: number;
  comment: string | null;
  submitted_at: string;
};

type RawClassSessionCompletionVoteRow = {
  schedule_id: string;
  occurrence_key: string;
  profile_id: string;
  role: string;
  status: 'confirmed' | 'disputed';
  dispute_category: string | null;
  dispute_reason: string | null;
  reschedule_requested: boolean;
  voted_at: string;
};

type AdminAccountRoleContext = {
  accountId: string;
};

type RawAdminAccountRow = {
  id: string;
};

type RawRoleRow = {
  role_key: string | null;
};

const ADMIN_ACTIVITY_FEED_LIMIT = 500;

function toDisplayName(profile?: ProfileRow | null): string {
  if (!profile) return 'Unknown user';
  const displayName = profile.display_name?.trim();
  if (displayName) return displayName;
  const firstName = profile.first_name?.trim() ?? '';
  const lastName = profile.last_name?.trim() ?? '';
  if (firstName && lastName) return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
  return firstName || 'Unknown user';
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function resolveChannelId(row: ActivityFeedItemRow): string | null {
  const metadata = asRecord(row.metadata);
  const metadataChannelId = getString(metadata.channelId);
  if (metadataChannelId) return metadataChannelId;

  const audience = asRecord(row.audience);
  const scope = asRecord(audience.scope);
  const scopedChannelId = getString(scope.channelId);
  if (scopedChannelId) return scopedChannelId;

  const refs = asRecord(row.refs);
  const objectRef = asRecord(refs.object);
  const targetRef = asRecord(refs.target);
  if (getString(objectRef.kind) === 'channel') return getString(objectRef.id);
  if (getString(targetRef.kind) === 'channel') return getString(targetRef.id);
  return null;
}

function describeScope(row: ActivityFeedItemRow, channel?: ChannelRow | null) {
  const audience = asRecord(row.audience);
  const scope = asRecord(audience.scope);
  const label = getString(scope.label);
  if (label) return label;

  const kind = getString(scope.kind);
  if (kind === 'channel') return channel?.topic?.trim() || 'Channel';
  if (kind === 'learning_space') {
    return getString(asRecord(row.metadata).classTitle) ?? 'Learning space';
  }
  if (kind === 'dm') return 'Direct message';
  if (kind === 'user') return 'User';
  return kind ?? 'Global';
}

function toAdminActor(profile?: ProfileRow | null) {
  if (!profile) return null;
  return {
    profileId: profile.id,
    displayName: toDisplayName(profile),
    kind: profile.kind ?? null,
  };
}

function resolveDeliveryChannel(job: EventPipelineJobRow) {
  return getString(job.payload?.deliveryChannel);
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getFeedbackClassSessionId(item: ActivityFeedItemVM) {
  const metadata = asRecord(item.metadata);
  if (typeof metadata.classSessionId === 'string') return metadata.classSessionId;
  if (typeof metadata.scheduleId === 'string') return metadata.scheduleId;
  return null;
}

function getFeedbackOccurrenceStart(item: ActivityFeedItemVM) {
  const metadata = asRecord(item.metadata);
  if (typeof metadata.occurrenceStart === 'string') return metadata.occurrenceStart;
  if (typeof metadata.startAt === 'string') return metadata.startAt;
  return null;
}

function getCompletionScheduleId(item: ActivityFeedItemVM) {
  const metadata = asRecord(item.metadata);
  return typeof metadata.scheduleId === 'string' ? metadata.scheduleId : null;
}

function getCompletionOccurrenceStart(item: ActivityFeedItemVM) {
  const metadata = asRecord(item.metadata);
  return typeof metadata.occurrenceStart === 'string' ? metadata.occurrenceStart : null;
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizeOccurrenceKey(value: string | null) {
  if (!value) return 'none';
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
}

function normalizeOccurrenceValue(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
}

function completionVoteKey(scheduleId: string, occurrenceStart: string) {
  return `${scheduleId}:${normalizeOccurrenceKey(occurrenceStart)}`;
}

function feedbackResponseKey(classSessionId: string, occurrenceStart: string | null) {
  return `${classSessionId}:${normalizeOccurrenceKey(occurrenceStart)}`;
}

function mapFeedbackResponse(row: RawClassSessionFeedbackRow) {
  return {
    sourceEventId: row.source_event_id,
    messageId: row.message_id,
    classSessionId: row.class_session_id,
    classroomId: row.classroom_id,
    channelId: row.channel_id,
    occurrenceStartAt: row.occurrence_start_at,
    rating: row.rating,
    comment: row.comment,
    submittedAt: row.submitted_at,
  };
}

function mapCompletionVote(row: RawClassSessionCompletionVoteRow) {
  return {
    scheduleId: row.schedule_id,
    occurrenceKey: normalizeOccurrenceValue(row.occurrence_key),
    profileId: row.profile_id,
    role: row.role,
    status: row.status,
    disputeCategory: row.dispute_category,
    disputeReason: row.dispute_reason,
    rescheduleRequested: row.reschedule_requested,
    votedAt: row.voted_at,
  };
}

function mapFeedRow(row: ActivityFeedItemRow): ActivityFeedItemVM {
  const contentBase = (row.content ?? {}) as Partial<ActivityItemContentVM>;
  const content: ActivityItemContentVM = {
    ...contentBase,
    headline: contentBase.headline ?? { primary: row.summary ?? 'Activity update' },
    summary: contentBase.summary ?? row.summary ?? undefined,
    preview:
      contentBase.preview ??
      (row.preview as ActivityItemContentVM['preview']) ??
      undefined,
    actionButton:
      contentBase.actionButton ??
      (row.action_button as ActivityItemContentVM['actionButton']) ??
      undefined,
    expandedContent: contentBase.expandedContent ?? row.expanded_content ?? undefined,
  };

  const refsBase = (row.refs ?? {}) as Partial<ActivityItemRefsVM>;
  const audienceBase = (row.audience ?? {}) as Partial<ActivityItemAudienceVM>;

  const state: ActivityItemStateVM = {
    importance: row.importance as ActivityItemStateVM['importance'],
    isRead: row.is_read ?? undefined,
  };

  return {
    kind: 'leaf',
    ids: { id: row.id, orgId: row.org_id },
    timestamps: {
      occurredAt: row.occurred_at ?? row.created_at,
      createdAt: row.created_at,
    },
    tabKey: row.tab_key as InboxTabKeyVM,
    audience: {
      ...audienceBase,
      scope: audienceBase.scope ?? { kind: 'global' },
      visibility: audienceBase.visibility ?? 'public',
    },
    verb: row.verb as ActivityVerbVM,
    refs: { ...refsBase } as ActivityItemRefsVM,
    content,
    state,
    metadata: {
      ...(row.metadata ?? {}),
      ...(row.source_event_id ? { sourceEventId: row.source_event_id } : {}),
    },
  } as ActivityFeedItemVM;
}

@Injectable()
export class ActivityFeedQueryService {
  private async requireAdminRole(
    authUserId: string,
    orgId: string,
  ): Promise<AdminAccountRoleContext> {
    const supabase = createSupabaseServiceClient();
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('auth_user_id', authUserId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<RawAdminAccountRow>();

    if (accountError) throw new InternalServerErrorException(accountError.message);
    if (!account) throw new ForbiddenException('Not a member of this organization');

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_key')
      .eq('account_id', account.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<RawRoleRow[]>();

    if (rolesError) throw new InternalServerErrorException(rolesError.message);

    const isAdmin = (roles ?? []).some(
      (role) => role.role_key === 'owner' || role.role_key === 'admin',
    );
    if (!isAdmin) throw new ForbiddenException('Forbidden');

    return { accountId: account.id };
  }

  private async loadAdminProfiles(orgId: string, profileIds: string[]) {
    const ids = Array.from(new Set(profileIds.filter(Boolean)));
    if (!ids.length) return new Map<string, ProfileRow>();

    const { data, error } = await createSupabaseServiceClient()
      .from('profiles')
      .select(
        'id,org_id,account_id,kind,display_name,first_name,last_name,avatar_source,avatar_url,status,created_at,updated_at',
      )
      .eq('org_id', orgId)
      .in('id', ids)
      .is('deleted_at', null)
      .returns<ProfileRow[]>();

    if (error) throw new InternalServerErrorException(error.message);
    return new Map((data ?? []).map((profile) => [profile.id, profile]));
  }

  private async loadAdminChannels(orgId: string, channelIds: string[]) {
    const ids = Array.from(new Set(channelIds.filter(Boolean)));
    if (!ids.length) return new Map<string, ChannelRow>();

    const { data, error } = await createSupabaseServiceClient()
      .from('channels')
      .select('id,org_id,kind,topic,visibility,purpose,status,created_at,updated_at')
      .eq('org_id', orgId)
      .in('id', ids)
      .is('deleted_at', null)
      .returns<ChannelRow[]>();

    if (error) throw new InternalServerErrorException(error.message);
    return new Map((data ?? []).map((channel) => [channel.id, channel]));
  }

  private async loadAdminPipelineJobs(orgId: string, sourceEventIds: string[]) {
    const ids = Array.from(new Set(sourceEventIds.filter(Boolean)));
    if (!ids.length) return new Map<string, EventPipelineJobRow[]>();

    const { data, error } = await createSupabaseServiceClient()
      .from('event_pipeline_jobs')
      .select('*')
      .eq('org_id', orgId)
      .in('source_id', ids)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .returns<EventPipelineJobRow[]>();

    if (error) throw new InternalServerErrorException(error.message);

    const byEvent = new Map<string, EventPipelineJobRow[]>();
    (data ?? []).forEach((job) => {
      if (!job.source_id) return;
      const jobs = byEvent.get(job.source_id) ?? [];
      jobs.push(job);
      byEvent.set(job.source_id, jobs);
    });

    return byEvent;
  }

  private mapAdminDeliveryChannels(
    jobs: EventPipelineJobRow[],
    recipientProfileId: string,
  ): AdminActivityFeedDeliveryChannelVM[] {
    return jobs
      .filter((job) => job.job_kind === 'notification.deliver')
      .filter((job) => getString(job.payload?.recipientProfileId) === recipientProfileId)
      .map((job) => ({
        channel: resolveDeliveryChannel(job) ?? 'unknown',
        status: job.status,
        createdAt: job.created_at,
        lastError: job.last_error ?? null,
      }));
  }

  private mapAdminPipelineJobs(jobs: EventPipelineJobRow[]) {
    return jobs.map(
      (job): AdminActivityFeedPipelineJobVM => ({
        id: job.id,
        kind: job.job_kind,
        status: job.status,
        attemptCount: job.attempt_count,
        runAt: job.run_at,
        createdAt: job.created_at,
        nextAttemptAt: job.next_attempt_at ?? null,
        lastError: job.last_error ?? null,
      }),
    );
  }

  private async loadAdminReminderJobs(orgId: string, sourceEventIds: string[]) {
    const ids = Array.from(new Set(sourceEventIds.filter(Boolean)));
    if (!ids.length) return new Map<string, AdminActivityFeedReminderJobVM[]>();

    const { data: logs, error: logsError } = await createSupabaseServiceClient()
      .from('reminder_dispatch_logs')
      .select('*')
      .eq('org_id', orgId)
      .in('activity_event_id', ids)
      .is('deleted_at', null)
      .returns<ReminderDispatchLogRow[]>();

    if (logsError) throw new InternalServerErrorException(logsError.message);

    const reminderJobIds = Array.from(
      new Set((logs ?? []).map((log) => log.reminder_job_id).filter(Boolean)),
    );
    if (!reminderJobIds.length) {
      return new Map<string, AdminActivityFeedReminderJobVM[]>();
    }

    const { data: jobs, error: jobsError } = await createSupabaseServiceClient()
      .from('reminder_jobs')
      .select('*')
      .eq('org_id', orgId)
      .in('id', reminderJobIds)
      .is('deleted_at', null)
      .returns<ReminderJobRow[]>();

    if (jobsError) throw new InternalServerErrorException(jobsError.message);

    const jobsById = new Map((jobs ?? []).map((job) => [job.id, job]));
    const byEvent = new Map<string, AdminActivityFeedReminderJobVM[]>();
    (logs ?? []).forEach((log) => {
      if (!log.activity_event_id) return;
      const job = jobsById.get(log.reminder_job_id);
      if (!job) return;

      const payload = asRecord(job.payload);
      const reminders = byEvent.get(log.activity_event_id) ?? [];
      reminders.push({
        id: job.id,
        jobType: job.job_type,
        status: job.status,
        targetKind: job.target_kind,
        targetId: job.target_id,
        runAt: job.run_at,
        occurrenceStartAt: job.occurrence_start_at ?? null,
        reminderOffsetMinutes: getNumber(payload.reminderOffsetMinutes),
        attemptCount: job.attempt_count,
        dispatchedAt: job.dispatched_at ?? null,
        lastError: job.last_error ?? null,
        dispatchResult: log.result ?? null,
      });
      byEvent.set(log.activity_event_id, reminders);
    });

    return byEvent;
  }

  private buildAdminVerbSummaries(items: AdminActivityFeedItemVM[]) {
    const summary = new Map<
      string,
      {
        count: number;
        unreadCount: number;
        recipients: Set<string>;
        channels: Set<string>;
        latestOccurredAt: string;
      }
    >();

    items.forEach((item) => {
      const current = summary.get(item.verb) ?? {
        count: 0,
        unreadCount: 0,
        recipients: new Set<string>(),
        channels: new Set<string>(),
        latestOccurredAt: item.occurredAt,
      };
      current.count += 1;
      if (!item.isRead) current.unreadCount += 1;
      current.recipients.add(item.recipient.profileId);
      if (item.channel?.channelId) current.channels.add(item.channel.channelId);
      if (
        new Date(item.occurredAt).getTime() > new Date(current.latestOccurredAt).getTime()
      ) {
        current.latestOccurredAt = item.occurredAt;
      }
      summary.set(item.verb, current);
    });

    return Array.from(summary.entries())
      .map(([verb, value]) => ({
        verb,
        count: value.count,
        unreadCount: value.unreadCount,
        recipientCount: value.recipients.size,
        channelCount: value.channels.size,
        latestOccurredAt: value.latestOccurredAt,
      }))
      .sort(
        (left, right) => right.count - left.count || left.verb.localeCompare(right.verb),
      );
  }

  async fetchAdminActivityFeedAudit(
    authUserId: string,
    orgId: string,
    options: { limit?: number } = {},
  ): Promise<AdminActivityFeedAuditVM> {
    await this.requireAdminRole(authUserId, orgId);

    const limit = Math.min(Math.max(options.limit ?? ADMIN_ACTIVITY_FEED_LIMIT, 1), 1000);
    const { data, error } = await createSupabaseServiceClient()
      .from('activity_feed_items')
      .select(ACTIVITY_FEED_ITEM_SELECT)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(limit)
      .returns<ActivityFeedItemRow[]>();

    if (error) throw new InternalServerErrorException(error.message);

    const rows = data ?? [];
    const profileIds = rows.flatMap((row) => [
      row.recipient_profile_id,
      row.actor_profile_id ?? '',
    ]);
    const channelIds = rows.map(resolveChannelId).filter(isNonEmptyString);
    const sourceEventIds = rows
      .map((row) => row.source_event_id ?? null)
      .filter(isNonEmptyString);

    const [profilesById, channelsById, pipelineJobsByEventId, reminderJobsByEventId] =
      await Promise.all([
        this.loadAdminProfiles(orgId, profileIds),
        this.loadAdminChannels(orgId, channelIds),
        this.loadAdminPipelineJobs(orgId, sourceEventIds),
        this.loadAdminReminderJobs(orgId, sourceEventIds),
      ]);

    const items = rows.map((row): AdminActivityFeedItemVM => {
      const recipientProfile = profilesById.get(row.recipient_profile_id);
      const actorProfile = row.actor_profile_id
        ? profilesById.get(row.actor_profile_id)
        : null;
      const channelId = resolveChannelId(row);
      const channel = channelId ? channelsById.get(channelId) : null;
      const pipelineJobs = row.source_event_id
        ? (pipelineJobsByEventId.get(row.source_event_id) ?? [])
        : [];
      const reminderJobs = row.source_event_id
        ? (reminderJobsByEventId.get(row.source_event_id) ?? [])
        : [];

      return {
        id: row.id,
        sourceEventId: row.source_event_id ?? null,
        verb: row.verb,
        tabKey: row.tab_key,
        summary:
          row.summary ?? getString(asRecord(row.content).summary) ?? 'Activity update',
        recipient: toAdminActor(recipientProfile) ?? {
          profileId: row.recipient_profile_id,
          displayName: 'Unknown user',
          kind: null,
        },
        actor: toAdminActor(actorProfile),
        channel: channelId
          ? {
              channelId,
              label: channel?.topic?.trim() || channelId,
              kind: channel?.kind ?? null,
            }
          : null,
        scopeLabel: describeScope(row, channel),
        importance: row.importance ?? null,
        isRead: row.is_read ?? false,
        occurredAt: row.occurred_at,
        createdAt: row.created_at,
        dedupeKey: row.dedupe_key ?? null,
        deliveryChannels: this.mapAdminDeliveryChannels(
          pipelineJobs,
          row.recipient_profile_id,
        ),
        pipelineJobs: this.mapAdminPipelineJobs(pipelineJobs),
        reminderJobs,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      totalCount: items.length,
      unreadCount: items.filter((item) => !item.isRead).length,
      pipelineJobCount: Array.from(pipelineJobsByEventId.values()).reduce(
        (total, jobs) => total + jobs.length,
        0,
      ),
      reminderJobCount: Array.from(reminderJobsByEventId.values()).reduce(
        (total, jobs) => total + jobs.length,
        0,
      ),
      verbSummaries: this.buildAdminVerbSummaries(items),
      items,
    };
  }

  private collectCompletionTargets(items: ActivityFeedItemVM[]) {
    const targets = new Map<string, { scheduleId: string; occurrenceStart: string }>();

    items
      .filter((item) => item.kind === 'leaf')
      .filter(
        (item) =>
          item.verb === 'session.completion_check.sent' ||
          item.verb === 'session.completion_check.batch.sent',
      )
      .forEach((item) => {
        if (item.verb === 'session.completion_check.sent') {
          const scheduleId = getCompletionScheduleId(item);
          const occurrenceStart = getCompletionOccurrenceStart(item);
          if (scheduleId && occurrenceStart) {
            targets.set(completionVoteKey(scheduleId, occurrenceStart), {
              scheduleId,
              occurrenceStart,
            });
          }
          return;
        }

        const metadata = asRecord(item.metadata);
        if (!Array.isArray(metadata.sessions)) return;
        metadata.sessions.forEach((session) => {
          const sessionRecord = asRecord(session);
          const scheduleId = sessionRecord.scheduleId;
          const occurrenceStart = sessionRecord.occurrenceStart;
          if (typeof scheduleId === 'string' && typeof occurrenceStart === 'string') {
            targets.set(completionVoteKey(scheduleId, occurrenceStart), {
              scheduleId,
              occurrenceStart,
            });
          }
        });
      });

    return Array.from(targets.values());
  }

  private async loadFeedbackResponses(
    accessToken: string,
    orgId: string,
    profileId: string,
    items: ActivityFeedItemVM[],
  ): Promise<Map<string, RawClassSessionFeedbackRow>> {
    const feedbackClassSessionIds = Array.from(
      new Set(
        items
          .filter((item) => item.kind === 'leaf')
          .filter((item) => item.verb === 'session.feedback_request.sent')
          .map(getFeedbackClassSessionId)
          .filter(isNonEmptyString),
      ),
    );
    if (!feedbackClassSessionIds.length) return new Map();

    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('class_session_feedback')
      .select(
        'source_event_id, message_id, class_session_id, classroom_id, channel_id, occurrence_start_at, rating, comment, submitted_at',
      )
      .eq('org_id', orgId)
      .eq('recipient_profile_id', profileId)
      .is('deleted_at', null)
      .in('class_session_id', feedbackClassSessionIds)
      .returns<RawClassSessionFeedbackRow[]>();
    if (error) throw new InternalServerErrorException(error.message);

    const responses = new Map<string, RawClassSessionFeedbackRow>();
    (data ?? []).forEach((row) => {
      responses.set(
        feedbackResponseKey(row.class_session_id, row.occurrence_start_at),
        row,
      );

      if (!responses.has(row.class_session_id)) {
        responses.set(row.class_session_id, row);
      }
    });

    return responses;
  }

  private async loadCompletionVotes(
    orgId: string,
    profileId: string,
    items: ActivityFeedItemVM[],
  ): Promise<Map<string, RawClassSessionCompletionVoteRow>> {
    const targets = this.collectCompletionTargets(items);
    if (!targets.length) return new Map();

    const scheduleIds = Array.from(new Set(targets.map((target) => target.scheduleId)));
    const occurrenceStarts = Array.from(
      new Set(targets.map((target) => target.occurrenceStart)),
    );

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('class_session_completion_votes')
      .select(
        'schedule_id, occurrence_key, profile_id, role, status, dispute_category, dispute_reason, reschedule_requested, voted_at',
      )
      .eq('org_id', orgId)
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .in('schedule_id', scheduleIds)
      .in('occurrence_key', occurrenceStarts)
      .returns<RawClassSessionCompletionVoteRow[]>();
    if (error) throw new InternalServerErrorException(error.message);

    return new Map(
      (data ?? []).map((row) => [
        completionVoteKey(row.schedule_id, row.occurrence_key),
        row,
      ]),
    );
  }

  private async loadActivityFeedActors(
    accessToken: string,
    orgId: string,
    rows: ActivityFeedItemRow[],
  ): Promise<Map<string, UserProfileVM>> {
    const actorIds = Array.from(
      new Set(rows.map((row) => row.actor_profile_id).filter(Boolean)),
    );
    if (!actorIds.length) return new Map();

    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name, avatar_url, avatar_seed, kind')
      .eq('org_id', orgId)
      .in('id', actorIds)
      .is('deleted_at', null)
      .returns<RawActivityActorProfile[]>();
    if (error) throw new InternalServerErrorException(error.message);

    return new Map(
      (data ?? []).map((profile) => [profile.id, buildSenderProfile(profile, orgId)]),
    );
  }

  private buildFeedSections(items: ActivityFeedItemVM[]): ActivityFeedSectionVM[] {
    if (!items.length) return [];
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const today: ActivityFeedItemVM[] = [];
    const yesterday: ActivityFeedItemVM[] = [];
    const thisWeek: ActivityFeedItemVM[] = [];
    const older: ActivityFeedItemVM[] = [];
    items.forEach((item) => {
      const occurredAt = new Date(item.timestamps.occurredAt);
      if (occurredAt >= startOfToday) {
        today.push(item);
      } else if (occurredAt >= startOfYesterday) {
        yesterday.push(item);
      } else if (occurredAt >= startOfWeek) {
        thisWeek.push(item);
      } else {
        older.push(item);
      }
    });

    const sections: ActivityFeedSectionVM[] = [];
    if (today.length) sections.push({ label: 'Today', items: today });
    if (yesterday.length) sections.push({ label: 'Yesterday', items: yesterday });
    if (thisWeek.length) sections.push({ label: 'This week', items: thisWeek });
    if (older.length) sections.push({ label: 'Earlier', items: older });
    return sections;
  }

  private buildFeedTabs(items: ActivityFeedItemVM[]): ActivityFeedTabVM[] {
    const counts = new Map<InboxTabKeyVM, number>();
    items.forEach((item) => {
      if (item.state?.isRead) return;
      counts.set(item.tabKey, (counts.get(item.tabKey) ?? 0) + 1);
    });

    return FEED_TABS.map((tab) => ({
      key: tab.key,
      label: tab.label,
      badgeCount:
        tab.key === 'all'
          ? Array.from(counts.values()).reduce((total, count) => total + count, 0)
          : (counts.get(tab.key) ?? 0),
    }));
  }

  async fetchFeed(
    accessToken: string,
    orgId: string,
    profileId: string,
  ): Promise<ActivityFeedVM> {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data: itemRows, error: itemsError } = await supabase
      .from('activity_feed_items')
      .select(ACTIVITY_FEED_ITEM_SELECT)
      .eq('org_id', orgId)
      .eq('recipient_profile_id', profileId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .returns<ActivityFeedItemRow[]>();
    if (itemsError) throw new InternalServerErrorException(itemsError.message);

    const rows = itemRows ?? [];
    const actorProfiles = await this.loadActivityFeedActors(accessToken, orgId, rows);

    const mappedItems = rows.map((row) => {
      const item = mapFeedRow(row);
      const hydratedActor = row.actor_profile_id
        ? actorProfiles.get(row.actor_profile_id)
        : null;
      if (!hydratedActor) return item;
      return {
        ...item,
        refs: { ...item.refs, actor: hydratedActor },
      } as ActivityFeedItemVM;
    });

    const feedbackResponses = await this.loadFeedbackResponses(
      accessToken,
      orgId,
      profileId,
      mappedItems,
    );
    const feedbackItems = mappedItems.map((item) => {
      if (item.kind !== 'leaf' || item.verb !== 'session.feedback_request.sent') {
        return item;
      }

      const feedbackClassSessionId = getFeedbackClassSessionId(item);
      if (!feedbackClassSessionId) return item;

      const feedbackOccurrenceStart = getFeedbackOccurrenceStart(item);
      const feedbackResponse =
        feedbackResponses.get(
          feedbackResponseKey(feedbackClassSessionId, feedbackOccurrenceStart),
        ) ??
        (feedbackOccurrenceStart ? null : feedbackResponses.get(feedbackClassSessionId));
      if (!feedbackResponse) return item;

      return {
        ...item,
        metadata: {
          ...(item.metadata ?? {}),
          feedbackResponse: mapFeedbackResponse(feedbackResponse),
        },
      } as ActivityFeedLeafItemVM;
    });
    const completionVotes = await this.loadCompletionVotes(
      orgId,
      profileId,
      feedbackItems,
    );
    const hydratedItems = feedbackItems.map((item) => {
      if (
        item.kind !== 'leaf' ||
        (item.verb !== 'session.completion_check.sent' &&
          item.verb !== 'session.completion_check.batch.sent')
      ) {
        return item;
      }

      if (item.verb === 'session.completion_check.sent') {
        const scheduleId = getCompletionScheduleId(item);
        const occurrenceStart = getCompletionOccurrenceStart(item);
        if (!scheduleId || !occurrenceStart) return item;

        const vote = completionVotes.get(completionVoteKey(scheduleId, occurrenceStart));
        if (!vote) return item;

        return {
          ...item,
          metadata: {
            ...(item.metadata ?? {}),
            completionVote: mapCompletionVote(vote),
          },
        } as ActivityFeedLeafItemVM;
      }

      const metadata = asRecord(item.metadata);
      if (!Array.isArray(metadata.sessions)) return item;

      return {
        ...item,
        metadata: {
          ...(item.metadata ?? {}),
          sessions: metadata.sessions.map((session) => {
            const sessionRecord = asRecord(session);
            const scheduleId = sessionRecord.scheduleId;
            const occurrenceStart = sessionRecord.occurrenceStart;
            if (typeof scheduleId !== 'string' || typeof occurrenceStart !== 'string') {
              return session;
            }

            const vote = completionVotes.get(
              completionVoteKey(scheduleId, occurrenceStart),
            );
            if (!vote) return session;

            return {
              ...sessionRecord,
              completionVote: mapCompletionVote(vote),
            };
          }),
        },
      } as ActivityFeedLeafItemVM;
    });

    const sections = this.buildFeedSections(hydratedItems);
    const tabs = this.buildFeedTabs(hydratedItems);
    const unreadCount = hydratedItems.filter((item) => !item.state?.isRead).length;

    return {
      activeTab: 'all',
      tabs,
      sections,
      nextCursor: null,
      unreadCount,
    };
  }

  async markRead(accessToken: string, orgId: string, profileId: string, ids: string[]) {
    if (!ids.length) return { success: true };
    const supabase = createSupabaseSessionClient(accessToken);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('activity_feed_items')
      .update({
        is_read: true,
        read_at: now,
        updated_at: now,
        updated_by: profileId,
      })
      .eq('org_id', orgId)
      .eq('recipient_profile_id', profileId)
      .in('id', ids);
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
