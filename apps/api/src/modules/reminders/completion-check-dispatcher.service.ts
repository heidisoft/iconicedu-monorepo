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

type EffectiveOccurrence = {
  sessionEndAt: string;
  sessionTitle: string | null;
  channelId: string | null;
  learningSpaceId: string | null;
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

// Which other participants' names are relevant to show *this* viewer, mirroring
// the homepage's own "Upcoming Sessions" tile (getViewerParticipantNames in
// apps/web/lib/dashboard/home-infographic-metrics.ts): an educator sees their
// student(s); a student sees their educator(s); staff/observer (no privacy
// boundary of their own) see the full roster. Guardians are handled separately
// (computeStudentNameForGuardian below) since their child-name half needs
// family_links privacy scoping that plain role-matching can't provide.
function computeContextParticipantNames(
  members: CompletionCheckMember[],
  viewerRole: string | null | undefined,
): string | null {
  const matchesViewer = (member: CompletionCheckMember) => {
    if (!member.displayName?.trim()) return false;
    if (viewerRole === 'child') return member.role === 'educator';
    if (viewerRole === 'educator') return member.role === 'child';
    return true;
  };
  const names = unique(
    members.filter(matchesViewer).map((member) => member.displayName!.trim()),
  );
  return names.length ? names.join(', ') : null;
}

@Injectable()
export class CompletionCheckDispatcherService {
  private readonly logger = new Logger(CompletionCheckDispatcherService.name);

  async reconcileRecentCompletionChecks(input: {
    supabase: SupabaseServiceClient;
    limit?: number;
  }): Promise<{ checked: number; reconciled: number; failed: number }> {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await input.supabase
      .from('reminder_jobs')
      .select('*')
      .eq('job_type', 'session.completion_check')
      .eq('status', 'succeeded')
      .is('completion_reconciled_at', null)
      .is('deleted_at', null)
      .gte('dispatched_at', cutoff)
      .order('dispatched_at', { ascending: true })
      .limit(Math.min(Math.max(input.limit ?? 50, 1), 100))
      .returns<ReminderJobRow[]>();

    if (error) throw new Error(error.message);

    let reconciled = 0;
    let failed = 0;
    for (const job of data ?? []) {
      try {
        if (!job.updated_by) {
          throw new Error(`Completion-check job ${job.id} has no system profile`);
        }
        await this.dispatchCompletionCheck({
          supabase: input.supabase,
          job,
          payload: (job.payload ?? {}) as ReminderJobPayload,
          systemProfileId: job.updated_by,
        });

        const reconciledAt = new Date().toISOString();
        const response = await input.supabase
          .from('reminder_jobs')
          .update({
            completion_reconciled_at: reconciledAt,
            updated_at: reconciledAt,
            updated_by: job.updated_by,
          })
          .eq('id', job.id)
          .eq('org_id', job.org_id)
          .eq('status', 'succeeded')
          .is('completion_reconciled_at', null);
        if (response.error) throw new Error(response.error.message);
        reconciled += 1;
      } catch (reconcileError) {
        failed += 1;
        this.logger.warn(
          `completion_check reconciliation failed jobId=${job.id}: ${
            reconcileError instanceof Error
              ? reconcileError.message
              : String(reconcileError)
          }`,
        );
      }
    }

    return { checked: (data ?? []).length, reconciled, failed };
  }

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

    // Re-resolve current cancel/reschedule state right before dispatching — closes a
    // real race the old system had: reminder-job *enqueue* timing is reconciled on
    // cancel/reschedule via DB triggers (up to ~1 min lag), but nothing previously
    // stopped an already-queued job from firing stale. A cancelled session must never
    // get a completion prompt; a rescheduled one must be timed off its new end, not
    // the original occurrence_key time.
    const effectiveOccurrence = await this.resolveEffectiveOccurrence({
      supabase,
      orgId: job.org_id,
      scheduleId,
      occurrenceStart,
      fallbackEndAt: endAt,
      fallbackTitle: payload.title,
      fallbackChannelId: payload.channelId,
      fallbackLearningSpaceId: payload.learningSpaceId ?? null,
    });

    if (!effectiveOccurrence) {
      this.logger.log(
        `completion_check: ${scheduleId}/${occurrenceStart} was cancelled, skipping dispatch`,
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
      const sessionCompletionId = await this.upsertSessionCompletion({
        supabase,
        orgId: job.org_id,
        scheduleId,
        occurrenceKey: occurrenceStart,
        profileId: member.profileId,
        role: member.role ?? 'observer',
        sessionEndAt: effectiveOccurrence.sessionEndAt,
        sessionTitle: effectiveOccurrence.sessionTitle,
        studentName: computeContextParticipantNames(members, member.role),
        channelId: effectiveOccurrence.channelId,
        learningSpaceId: effectiveOccurrence.learningSpaceId,
      });
      if (!sessionCompletionId) continue;

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
          sessionCompletionId,
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
        currentScheduleId: scheduleId,
        currentOccurrenceStart: occurrenceStart,
        currentEndAt: endAt,
        currentPayload: payload,
        currentEffectiveOccurrence: effectiveOccurrence,
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
    currentScheduleId: string;
    currentOccurrenceStart: string;
    currentEndAt: string | null;
    currentPayload: ReminderJobPayload;
    currentEffectiveOccurrence: EffectiveOccurrence;
    systemProfileId: string;
  }): Promise<string[]> {
    const {
      supabase,
      orgId,
      guardianProfileId,
      currentScheduleId,
      currentOccurrenceStart,
      currentEndAt,
      currentPayload,
      currentEffectiveOccurrence,
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
      const studentName = await this.computeStudentNameForGuardian({
        supabase,
        orgId,
        guardianProfileId,
        members: currentPayload.members ?? [],
      });
      const sessionCompletionId = await this.upsertSessionCompletion({
        supabase,
        orgId,
        scheduleId: currentScheduleId,
        occurrenceKey: currentOccurrenceStart,
        profileId: guardianProfileId,
        role: 'guardian',
        sessionEndAt: currentEffectiveOccurrence.sessionEndAt,
        sessionTitle: currentEffectiveOccurrence.sessionTitle,
        studentName,
        channelId: currentEffectiveOccurrence.channelId,
        learningSpaceId: currentEffectiveOccurrence.learningSpaceId,
      });
      if (!sessionCompletionId) return [];

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
          sessionCompletionId,
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

    const currentStudentName = await this.computeStudentNameForGuardian({
      supabase,
      orgId,
      guardianProfileId,
      members: currentPayload.members ?? [],
    });
    const currentSessionCompletionId = await this.upsertSessionCompletion({
      supabase,
      orgId,
      scheduleId: currentScheduleId,
      occurrenceKey: currentOccurrenceStart,
      profileId: guardianProfileId,
      role: 'guardian',
      sessionEndAt: currentEffectiveOccurrence.sessionEndAt,
      sessionTitle: currentEffectiveOccurrence.sessionTitle,
      studentName: currentStudentName,
      channelId: currentEffectiveOccurrence.channelId,
      learningSpaceId: currentEffectiveOccurrence.learningSpaceId,
    });

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
      sessionCompletionId: currentSessionCompletionId,
    };

    // Each concurrent session was fetched fresh (excluding 'cancelled') just above, so
    // its own end_at is already current — no separate re-resolution needed here.
    const concurrentEntries = await Promise.all(
      concurrentSessions.map(async (s) => {
        const members = s.participants.map((p) => ({
          profileId: p.profile_id,
          role: p.role as 'educator' | 'child' | 'guardian' | 'staff' | 'observer' | null,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
          themeKey: p.theme_key,
        }));
        const studentName = await this.computeStudentNameForGuardian({
          supabase,
          orgId,
          guardianProfileId,
          members,
        });
        return {
          channelId: s.source_channel_id ?? '',
          learningSpaceId: s.source_learning_space_id ?? null,
          scheduleId: s.id,
          occurrenceStart: s.end_at,
          title: s.title,
          summary: null,
          channelRouteKind: 'space' as const,
          members,
          feedbackUiEnabled: true,
          sessionCompletionId: await this.upsertSessionCompletion({
            supabase,
            orgId,
            scheduleId: s.id,
            occurrenceKey: s.end_at,
            profileId: guardianProfileId,
            role: 'guardian',
            sessionEndAt: s.end_at,
            sessionTitle: s.title,
            studentName,
            channelId: s.source_channel_id ?? null,
            learningSpaceId: s.source_learning_space_id ?? null,
          }),
        };
      }),
    );

    const allSessions = [currentSessionEntry, ...concurrentEntries];
    const sessionCompletionIds = allSessions
      .map((s) => s.sessionCompletionId)
      .filter((id): id is string => Boolean(id));

    if (!sessionCompletionIds.length) return [];

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
        sessionCompletionIds,
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

  /**
   * Resolves the name(s) shown on a guardian's completion tile: the educator(s')
   * name(s) (not privacy-sensitive — every participant in the class already sees
   * their own class's educator) plus ONLY the children in `members` that are
   * linked to this specific guardian via `family_links` — never the full session
   * roster. That child-scoping is what prevents a guardian in a group class from
   * seeing another family's child's name on their own completion tile. Mirrors
   * the "parents" branch of getViewerParticipantNames (targetRoles = child +
   * educator) in apps/web/lib/dashboard/home-infographic-metrics.ts.
   */
  private async computeStudentNameForGuardian(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    guardianProfileId: string;
    members: CompletionCheckMember[];
  }): Promise<string | null> {
    const educatorNames = unique(
      input.members
        .filter((member) => member.role === 'educator' && member.displayName?.trim())
        .map((member) => member.displayName!.trim()),
    );
    const fallbackToEducatorsOnly = () =>
      educatorNames.length ? educatorNames.join(', ') : null;

    const childMembers = input.members.filter(
      (member) => member.role === 'child' && member.displayName?.trim(),
    );
    if (!childMembers.length) return fallbackToEducatorsOnly();

    const { data: guardianProfile } = await input.supabase
      .from('profiles')
      .select('account_id')
      .eq('org_id', input.orgId)
      .eq('id', input.guardianProfileId)
      .is('deleted_at', null)
      .maybeSingle<{ account_id: string }>();
    if (!guardianProfile?.account_id) return fallbackToEducatorsOnly();

    const childProfileIds = unique(childMembers.map((member) => member.profileId));
    const { data: childProfiles, error } = await input.supabase
      .from('profiles')
      .select('id, account_id')
      .eq('org_id', input.orgId)
      .in('id', childProfileIds)
      .is('deleted_at', null)
      .returns<Array<{ id: string; account_id: string }>>();
    if (error) throw new Error(error.message);

    const childAccountIdByProfileId = new Map(
      (childProfiles ?? []).map((profile) => [profile.id, profile.account_id]),
    );
    const childAccountIds = unique(Array.from(childAccountIdByProfileId.values()));
    if (!childAccountIds.length) return fallbackToEducatorsOnly();

    const { data: links, error: linksError } = await input.supabase
      .from('family_links')
      .select('child_account_id')
      .eq('org_id', input.orgId)
      .eq('guardian_account_id', guardianProfile.account_id)
      .in('child_account_id', childAccountIds)
      .is('deleted_at', null)
      .returns<Array<{ child_account_id: string }>>();
    if (linksError) throw new Error(linksError.message);

    const linkedAccountIds = new Set((links ?? []).map((link) => link.child_account_id));
    const linkedChildNames = childMembers
      .filter((member) =>
        linkedAccountIds.has(childAccountIdByProfileId.get(member.profileId) ?? ''),
      )
      .map((member) => member.displayName!.trim());

    const names = unique([...linkedChildNames, ...educatorNames]);
    return names.length ? names.join(', ') : null;
  }

  /**
   * Re-resolves current cancel/reschedule state for (scheduleId, occurrenceStart) right
   * before dispatch, closing the race described where an already-queued job could
   * otherwise fire stale. Returns null if the occurrence was cancelled (dispatch must
   * be aborted entirely); otherwise returns the effective session_end_at to use —
   * the override's patched end time for a rescheduled recurring occurrence, or the
   * schedule's own current end_at for a one-off session (reschedules on those are
   * already reflected in-place).
   */
  private async resolveEffectiveOccurrence(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    scheduleId: string;
    occurrenceStart: string;
    fallbackEndAt: string | null;
    fallbackTitle: string;
    fallbackChannelId: string;
    fallbackLearningSpaceId: string | null;
  }): Promise<EffectiveOccurrence | null> {
    const { supabase, orgId, scheduleId, occurrenceStart } = input;

    const { data: schedule } = await supabase
      .from('class_schedules')
      .select('id, title, status, end_at, source_channel_id, source_learning_space_id')
      .eq('org_id', orgId)
      .eq('id', scheduleId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        title: string;
        status: string;
        end_at: string;
        source_channel_id: string | null;
        source_learning_space_id: string | null;
      }>();

    if (!schedule) {
      // Schedule was hard-deleted since the job was queued — nothing to dispatch for.
      return null;
    }
    if (schedule.status === 'cancelled') {
      return null;
    }

    const { data: recurrence } = await supabase
      .from('class_schedule_recurrence')
      .select('id')
      .eq('org_id', orgId)
      .eq('schedule_id', scheduleId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (!recurrence) {
      // One-off session: reschedules mutate start_at/end_at in place, so the freshly
      // fetched row is already current — no separate override lookup needed.
      return {
        sessionEndAt: schedule.end_at,
        sessionTitle: schedule.title,
        channelId: schedule.source_channel_id,
        learningSpaceId: schedule.source_learning_space_id,
      };
    }

    const { data: exception } = await supabase
      .from('class_schedule_recurrence_exceptions')
      .select('id')
      .eq('org_id', orgId)
      .eq('recurrence_id', recurrence.id)
      .eq('occurrence_key', occurrenceStart)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (exception) {
      // This occurrence was cancelled after the job was queued.
      return null;
    }

    const { data: override } = await supabase
      .from('class_schedule_recurrence_overrides')
      .select('patch')
      .eq('org_id', orgId)
      .eq('recurrence_id', recurrence.id)
      .eq('occurrence_key', occurrenceStart)
      .is('deleted_at', null)
      .maybeSingle<{ patch: { endAt?: string | null } | null }>();

    const overrideEndAt = override?.patch?.endAt ?? null;

    return {
      sessionEndAt: overrideEndAt ?? input.fallbackEndAt ?? occurrenceStart,
      sessionTitle: input.fallbackTitle,
      channelId: input.fallbackChannelId,
      learningSpaceId: input.fallbackLearningSpaceId,
    };
  }

  /**
   * Idempotent upsert into class_session_completions — the new source of truth,
   * inserted BEFORE the notification is published. Clients can no longer insert their
   * own row (RLS restricts insert to the service role), so this upsert must be safe to
   * run again after a partial dispatch failure: `on conflict ... do nothing` means an
   * already-created row is untouched and a retried dispatch simply fills in whatever's
   * still missing, rather than ever leaving a participant with no row to act on.
   */
  private async upsertSessionCompletion(input: {
    supabase: SupabaseServiceClient;
    orgId: string;
    scheduleId: string;
    occurrenceKey: string;
    profileId: string;
    role: string;
    sessionEndAt: string;
    sessionTitle: string | null;
    studentName?: string | null;
    channelId: string | null;
    learningSpaceId: string | null;
  }): Promise<string> {
    const now = new Date().toISOString();
    const expiresAt = new Date(
      new Date(input.sessionEndAt).getTime() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await input.supabase
      .from('class_session_completions')
      .upsert(
        {
          org_id: input.orgId,
          schedule_id: input.scheduleId,
          occurrence_key: input.occurrenceKey,
          profile_id: input.profileId,
          role: input.role,
          status: 'pending',
          channel_id: input.channelId,
          learning_space_id: input.learningSpaceId,
          session_title: input.sessionTitle,
          student_name: input.studentName ?? null,
          session_end_at: input.sessionEndAt,
          notified_at: now,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        },
        {
          onConflict: 'org_id,schedule_id,occurrence_key,profile_id',
          ignoreDuplicates: true,
        },
      )
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) {
      this.logger.error(
        `upsertSessionCompletion failed scheduleId=${input.scheduleId} profileId=${input.profileId}: ${error.message}`,
      );
      throw new Error(error.message);
    }

    if (data?.id) {
      return data.id;
    }

    // ignoreDuplicates suppresses the row from `.select()` on a pre-existing conflict —
    // fetch it so the caller still gets a sessionCompletionId to stamp into the event.
    const { data: existing, error: existingError } = await input.supabase
      .from('class_session_completions')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('schedule_id', input.scheduleId)
      .eq('occurrence_key', input.occurrenceKey)
      .eq('profile_id', input.profileId)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw new Error(existingError.message);
    }
    if (!existing?.id) {
      throw new Error(
        `Session completion upsert returned no row for ${input.scheduleId}/${input.profileId}`,
      );
    }

    return existing.id;
  }
}
