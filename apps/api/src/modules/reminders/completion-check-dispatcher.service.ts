import { Injectable, Logger } from '@nestjs/common';
import type { ReminderJobRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

// Window in minutes: if a guardian has other sessions ending within this range,
// they receive a single batched completion-check event instead of N individual ones.
const GUARDIAN_BATCH_WINDOW_MINUTES = 30;

type ReminderJobPayload = {
  title: string;
  summary?: string | null;
  channelId: string;
  learningSpaceId?: string | null;
  scheduleId?: string | null;
  occurrenceStart?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
  members?: Array<{
    profileId: string;
    role?: 'educator' | 'child' | 'guardian' | 'staff' | 'observer' | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }> | null;
};

type SessionRow = {
  id: string;
  title: string;
  end_at: string;
  source_channel_id: string | null;
  source_learning_space_id: string | null;
  participants: Array<{
    profile_id: string;
    role: string;
    display_name: string | null;
    avatar_url: string | null;
    theme_key: string | null;
  }>;
};

type CompletionCheckMember = NonNullable<ReminderJobPayload['members']>[number];

type ProfileSummaryRow = {
  id: string;
  account_id: string;
  kind: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  ui_theme_key: string | null;
};

type FamilyLinkSummaryRow = {
  guardian_account_id: string;
  child_account_id: string;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildDisplayName(profile: ProfileSummaryRow) {
  const fullName = [profile.first_name, profile.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim();

  return profile.display_name?.trim() || fullName || null;
}

@Injectable()
export class CompletionCheckDispatcherService {
  private readonly logger = new Logger(CompletionCheckDispatcherService.name);

  /**
   * Called from RemindersService when a session.completion_check job is dequeued.
   * Dispatches per-participant completion-check activity events, batching guardians
   * that have multiple sessions ending in the same time window.
   *
   * Returns the list of activity event IDs that were published.
   */
  async dispatchCompletionCheck(input: {
    supabase: SupabaseServiceClient;
    job: ReminderJobRow;
    payload: ReminderJobPayload;
    systemProfileId: string;
  }): Promise<string[]> {
    const { supabase, job, payload, systemProfileId } = input;

    const scheduleId = payload.scheduleId ?? job.source_schedule_id;
    const occurrenceStart = payload.occurrenceStart ?? payload.startAt ?? null;
    const endAt = payload.endAt ?? null;

    if (!scheduleId || !occurrenceStart) {
      this.logger.warn(
        `completion_check: missing scheduleId or occurrenceStart for job ${job.id}`,
      );
      return [];
    }

    // Check idempotency: skip if votes already exist for this session+occurrence
    const existingVotes = await supabase
      .from('class_session_completion_votes')
      .select('id')
      .eq('org_id', job.org_id)
      .eq('schedule_id', scheduleId)
      .eq('occurrence_key', occurrenceStart)
      .is('deleted_at', null)
      .limit(1);

    if (existingVotes.data && existingVotes.data.length > 0) {
      this.logger.log(
        `completion_check: votes already exist for ${scheduleId}/${occurrenceStart}, skipping`,
      );
      return [];
    }

    const members = payload.members ?? [];
    const activityEventIds: string[] = [];

    // Partition members by role
    const guardians = await this.resolveGuardianMembersForCompletionCheck({
      supabase,
      orgId: job.org_id,
      members,
    });
    const nonGuardians = members.filter((m) => m.role !== 'guardian');

    // Dispatch individual events for non-guardians (educators, students, staff)
    for (const member of nonGuardians) {
      const event = await publishActivityEvent({
        supabase,
        orgId: job.org_id,
        eventType: 'session.completion_check.sent',
        sourceKind: 'system',
        actorProfileId: systemProfileId,
        scope: payload.learningSpaceId
          ? { kind: 'learning_space', learningSpaceId: payload.learningSpaceId }
          : { kind: 'channel', channelId: payload.channelId },
        objectRef: { kind: 'session', id: scheduleId },
        targetRef: payload.learningSpaceId
          ? { kind: 'learning_space', id: payload.learningSpaceId }
          : null,
        audienceRules: [{ kind: 'users_only', userIds: [member.profileId] }],
        payload: {
          channelId: payload.channelId,
          learningSpaceId: payload.learningSpaceId ?? null,
          scheduleId,
          occurrenceStart,
          title: payload.title,
          summary: payload.summary ?? null,
          channelRouteKind: payload.channelRouteKind ?? 'space',
          members,
          feedbackUiEnabled: true,
        },
        dedupeKey: `session.completion_check:${job.org_id}:${scheduleId}:${occurrenceStart}:${member.profileId}`,
        refreshOnDedupe: false,
        createdBy: systemProfileId,
      });

      if (event?.id) {
        activityEventIds.push(event.id);
      }
    }

    // For guardians: check for concurrent sessions and batch if needed
    for (const guardian of guardians) {
      const batchedIds = await this.dispatchGuardianCompletionCheck({
        supabase,
        orgId: job.org_id,
        guardianProfileId: guardian.profileId,
        guardian,
        currentScheduleId: scheduleId,
        currentOccurrenceStart: occurrenceStart,
        currentEndAt: endAt,
        currentPayload: payload,
        systemProfileId,
      });
      activityEventIds.push(...batchedIds);
    }

    return activityEventIds;
  }

  private async dispatchGuardianCompletionCheck(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    guardianProfileId: string;
    guardian: NonNullable<ReminderJobPayload['members']>[number];
    currentScheduleId: string;
    currentOccurrenceStart: string;
    currentEndAt: string | null;
    currentPayload: ReminderJobPayload;
    systemProfileId: string;
  }): Promise<string[]> {
    const {
      supabase,
      orgId,
      guardianProfileId,
      guardian,
      currentScheduleId,
      currentOccurrenceStart,
      currentEndAt,
      currentPayload,
      systemProfileId,
    } = input;

    // Find other sessions for this guardian ending within the batch window
    const baseEndAt = currentEndAt ?? currentOccurrenceStart;
    const windowStart = new Date(
      new Date(baseEndAt).getTime() - GUARDIAN_BATCH_WINDOW_MINUTES * 60 * 1000,
    ).toISOString();
    const windowEnd = new Date(
      new Date(baseEndAt).getTime() + GUARDIAN_BATCH_WINDOW_MINUTES * 60 * 1000,
    ).toISOString();

    const concurrentResponse = await supabase
      .from('class_schedules')
      .select(
        `id, title, end_at, source_channel_id, source_learning_space_id,
         participants:class_schedule_participants(profile_id, role, display_name, avatar_url, theme_key)`,
      )
      .eq('org_id', orgId)
      .eq('source_kind', 'class_session')
      .neq('id', currentScheduleId)
      .neq('status', 'cancelled')
      .gte('end_at', windowStart)
      .lte('end_at', windowEnd)
      .is('deleted_at', null)
      .returns<SessionRow[]>();

    const concurrentSessions = (concurrentResponse.data ?? []).filter((s) =>
      s.participants.some((p) => p.profile_id === guardianProfileId),
    );

    if (concurrentSessions.length === 0) {
      // No concurrent sessions — dispatch single event
      const event = await publishActivityEvent({
        supabase,
        orgId,
        eventType: 'session.completion_check.sent',
        sourceKind: 'system',
        actorProfileId: systemProfileId,
        scope: currentPayload.learningSpaceId
          ? { kind: 'learning_space', learningSpaceId: currentPayload.learningSpaceId }
          : { kind: 'channel', channelId: currentPayload.channelId },
        objectRef: { kind: 'session', id: currentScheduleId },
        targetRef: currentPayload.learningSpaceId
          ? { kind: 'learning_space', id: currentPayload.learningSpaceId }
          : null,
        audienceRules: [{ kind: 'users_only', userIds: [guardianProfileId] }],
        payload: {
          channelId: currentPayload.channelId,
          learningSpaceId: currentPayload.learningSpaceId ?? null,
          scheduleId: currentScheduleId,
          occurrenceStart: currentOccurrenceStart,
          title: currentPayload.title,
          summary: currentPayload.summary ?? null,
          channelRouteKind: currentPayload.channelRouteKind ?? 'space',
          members: currentPayload.members ?? [],
          feedbackUiEnabled: true,
        },
        dedupeKey: `session.completion_check:${orgId}:${currentScheduleId}:${currentOccurrenceStart}:${guardianProfileId}`,
        refreshOnDedupe: false,
        createdBy: systemProfileId,
      });

      return event?.id ? [event.id] : [];
    }

    // Multiple concurrent sessions — dispatch a single batched event
    // Dedupe key is scoped to the guardian + window start so all sessions
    // in this window share the same batch event.
    const batchDedupeKey = `session.completion_check.batch:${orgId}:${guardianProfileId}:${windowStart}`;

    const currentSessionEntry = {
      channelId: currentPayload.channelId,
      learningSpaceId: currentPayload.learningSpaceId ?? null,
      scheduleId: currentScheduleId,
      occurrenceStart: currentOccurrenceStart,
      title: currentPayload.title,
      summary: currentPayload.summary ?? null,
      channelRouteKind: (currentPayload.channelRouteKind ?? 'space') as
        | 'space'
        | 'dm'
        | 'channel',
      members: currentPayload.members ?? [],
      feedbackUiEnabled: true,
    };

    const concurrentEntries = concurrentSessions.map((s) => ({
      channelId: s.source_channel_id ?? '',
      learningSpaceId: s.source_learning_space_id ?? null,
      scheduleId: s.id,
      occurrenceStart: s.end_at,
      title: s.title,
      summary: null,
      channelRouteKind: 'space' as const,
      members: s.participants.map((p) => ({
        profileId: p.profile_id,
        role: p.role as 'educator' | 'child' | 'guardian' | 'staff' | 'observer' | null,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        themeKey: p.theme_key,
      })),
      feedbackUiEnabled: true,
    }));

    const allSessions = [currentSessionEntry, ...concurrentEntries];

    const event = await publishActivityEvent({
      supabase,
      orgId,
      eventType: 'session.completion_check.batch.sent',
      sourceKind: 'system',
      actorProfileId: systemProfileId,
      scope: { kind: 'global' },
      audienceRules: [{ kind: 'users_only', userIds: [guardianProfileId] }],
      payload: {
        sessions: allSessions,
        sessionCount: allSessions.length,
      },
      dedupeKey: batchDedupeKey,
      refreshOnDedupe: true,
      createdBy: systemProfileId,
    });

    return event?.id ? [event.id] : [];
  }

  private async resolveGuardianMembersForCompletionCheck(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    members: CompletionCheckMember[];
  }): Promise<CompletionCheckMember[]> {
    const explicitGuardians = input.members.filter(
      (member) => member.role === 'guardian',
    );
    const explicitGuardianIds = new Set(
      explicitGuardians.map((member) => member.profileId),
    );
    const childProfileIds = unique(
      input.members
        .filter((member) => member.role === 'child')
        .map((member) => member.profileId),
    );

    if (!childProfileIds.length) {
      return explicitGuardians;
    }

    const childProfilesResponse = await input.supabase
      .from('profiles')
      .select('id, account_id, kind')
      .eq('org_id', input.orgId)
      .in('id', childProfileIds)
      .is('deleted_at', null)
      .returns<Array<{ id: string; account_id: string; kind: string | null }>>();

    if (childProfilesResponse.error) {
      throw new Error(childProfilesResponse.error.message);
    }

    const childAccountIds = unique(
      (childProfilesResponse.data ?? [])
        .filter((profile) => profile.kind === 'child')
        .map((profile) => profile.account_id),
    );

    if (!childAccountIds.length) {
      return explicitGuardians;
    }

    const familyLinksResponse = await input.supabase
      .from('family_links')
      .select('guardian_account_id, child_account_id')
      .eq('org_id', input.orgId)
      .in('child_account_id', childAccountIds)
      .is('deleted_at', null)
      .returns<FamilyLinkSummaryRow[]>();

    if (familyLinksResponse.error) {
      throw new Error(familyLinksResponse.error.message);
    }

    const guardianAccountIds = unique(
      (familyLinksResponse.data ?? []).map((link) => link.guardian_account_id),
    );

    if (!guardianAccountIds.length) {
      return explicitGuardians;
    }

    const guardianProfilesResponse = await input.supabase
      .from('profiles')
      .select(
        'id, account_id, kind, display_name, first_name, last_name, avatar_url, ui_theme_key',
      )
      .eq('org_id', input.orgId)
      .in('account_id', guardianAccountIds)
      .is('deleted_at', null)
      .returns<ProfileSummaryRow[]>();

    if (guardianProfilesResponse.error) {
      throw new Error(guardianProfilesResponse.error.message);
    }

    const linkedGuardians = (guardianProfilesResponse.data ?? [])
      .filter(
        (profile) => profile.kind === 'guardian' && !explicitGuardianIds.has(profile.id),
      )
      .map(
        (profile): CompletionCheckMember => ({
          profileId: profile.id,
          role: 'guardian',
          displayName: buildDisplayName(profile),
          avatarUrl: profile.avatar_url,
          themeKey: profile.ui_theme_key,
        }),
      );

    return [...explicitGuardians, ...linkedGuardians];
  }
}
