import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdminConfirmSessionCompletionInput,
  AdminDeleteSessionCompletionInput,
  AdminOrgProfileOptionVM,
  AdminSessionCompletionActorVM,
  AdminSessionCompletionGuardianVM,
  AdminSessionCompletionParticipantVM,
  AdminSessionCompletionVM,
  ChannelSessionCompletionVM,
  ClassSessionCompletionRow,
  ConfirmSessionCompletionInput,
  ConnectionVM,
  DisputeSessionCompletionInput,
  RateSessionCompletionInput,
  SessionCompletionVM,
  SkipSessionCompletionRatingInput,
  UndoSessionCompletionInput,
} from '@iconicedu/shared-types';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

type AccountRow = { id: string; org_id: string };
type ProfileRow = {
  id: string;
  account_id: string;
  org_id: string;
  kind?: string | null;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
// Matches the "Edit rating" window already used by ActivityFeedbackRequest — same
// pattern, applied to undoing a confirm/dispute instead of editing a rating.
const UNDO_WINDOW_MS = 60_000;

const DISPUTE_CATEGORIES = [
  'teacher_absent',
  'student_absent',
  'technical_issue',
  'other',
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`Text exceeds ${maxLength} characters`);
  }
  return trimmed;
}

function toVM(row: ClassSessionCompletionRow): SessionCompletionVM {
  return {
    id: row.id,
    orgId: row.org_id,
    scheduleId: row.schedule_id,
    occurrenceKey: row.occurrence_key,
    profileId: row.profile_id,
    role: row.role,
    status: row.status,
    disputeCategory: row.dispute_category ?? null,
    disputeReason: row.dispute_reason ?? null,
    rescheduleRequested: row.reschedule_requested,
    rating: row.rating ?? null,
    ratingComment: row.rating_comment ?? null,
    channelId: row.channel_id ?? null,
    learningSpaceId: row.learning_space_id ?? null,
    sessionTitle: row.session_title ?? null,
    studentName: row.student_name ?? null,
    sessionEndAt: row.session_end_at,
    notifiedAt: row.notified_at ?? null,
    confirmedAt: row.confirmed_at ?? null,
    disputedAt: row.disputed_at ?? null,
    ratedAt: row.rated_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    expiresAt: row.expires_at,
  };
}

@Injectable()
export class SessionCompletionsService {
  private readonly logger = new Logger(SessionCompletionsService.name);

  async listForProfile(
    authUserId: string,
    params: { orgId: string; profileId: string; cursor?: string | null; limit?: number },
  ): Promise<ConnectionVM<SessionCompletionVM>> {
    if (!params?.orgId || !isUuid(params.orgId)) {
      throw new BadRequestException('Invalid orgId');
    }
    if (!params.profileId || !isUuid(params.profileId)) {
      throw new BadRequestException('Invalid profileId');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, params.orgId);
    await this.resolvePermittedProfile(supabase, account, params.orgId, params.profileId);

    const requestedLimit = Math.floor(params.limit ?? DEFAULT_PAGE_SIZE);
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE);
    let cursorOrderKey: string | null = null;
    let cursorId: string | null = null;
    if (params.cursor) {
      const decoded = this.decodeCursor(params.cursor);
      cursorOrderKey = decoded.orderKey;
      cursorId = decoded.id;
    }

    // Fetch one extra row to know whether a next page exists, without a separate count query.
    const response = await supabase.rpc('list_class_session_completions_for_profile', {
      p_org_id: params.orgId,
      p_profile_id: params.profileId,
      p_limit: limit + 1,
      p_cursor_order_key: cursorOrderKey,
      p_cursor_id: cursorId,
    });

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }

    const rows = (response.data ?? []) as Array<
      ClassSessionCompletionRow & { order_key: string }
    >;
    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const last = page[page.length - 1];

    return {
      items: page.map((row) => toVM(row)),
      nextCursor: hasMore && last ? this.encodeCursor(last.order_key, last.id) : null,
      total: null,
    };
  }

  /**
   * Aggregate completion totals for the home dashboard's "Sessions completed"
   * tile. Deliberately NOT derived from listForProfile's page — that query is
   * capped at MAX_PAGE_SIZE and only surfaces resolved rows from the last 3 days
   * (its carousel/inbox visibility window), so counting it would silently drop
   * confirmations older than 3 days and truncate large profiles. These are
   * exact COUNTs over the whole table instead:
   *   - `completed`: confirmed / auto_confirmed rows, optionally bounded to a
   *     session-end window (the tile shows "this month").
   *   - `pending`: all rows still awaiting the viewer's action (unbounded — a
   *     pending row auto-expires via `expires_at` anyway).
   */
  async getCompletionSummaryForProfile(
    authUserId: string,
    params: {
      orgId: string;
      profileId: string;
      completedSince?: string | null;
      completedUntil?: string | null;
    },
  ): Promise<{ completed: number; pending: number }> {
    if (!params?.orgId || !isUuid(params.orgId)) {
      throw new BadRequestException('Invalid orgId');
    }
    if (!params?.profileId || !isUuid(params.profileId)) {
      throw new BadRequestException('Invalid profileId');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, params.orgId);
    await this.resolvePermittedProfile(supabase, account, params.orgId, params.profileId);

    const scopedCount = () =>
      supabase
        .from('class_session_completions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', params.orgId)
        .eq('profile_id', params.profileId)
        .is('deleted_at', null);

    let completedQuery = scopedCount().in('status', ['confirmed', 'auto_confirmed']);
    if (params.completedSince) {
      completedQuery = completedQuery.gte('session_end_at', params.completedSince);
    }
    if (params.completedUntil) {
      completedQuery = completedQuery.lt('session_end_at', params.completedUntil);
    }

    const [completedResult, pendingResult] = await Promise.all([
      completedQuery,
      scopedCount().eq('status', 'pending'),
    ]);

    if (completedResult.error) {
      throw new InternalServerErrorException(completedResult.error.message);
    }
    if (pendingResult.error) {
      throw new InternalServerErrorException(pendingResult.error.message);
    }

    return {
      completed: completedResult.count ?? 0,
      pending: pendingResult.count ?? 0,
    };
  }

  /**
   * Org-wide completion totals for the home dashboard's "Sessions completed"
   * tile when the viewer is staff/admin. Unlike getCompletionSummaryForProfile,
   * this is NOT scoped to a single profile — it reports every classroom session
   * in the org. Rows are collapsed to session occurrences (schedule +
   * occurrence_key) so a session confirmed by both a student and an educator
   * counts once — mirroring listForAdmin and listChannelCompletionStates:
   *   - `completed`: occurrences with a confirmed / auto_confirmed row whose
   *     `session_end_at` falls in the optional window (the tile shows "this
   *     month", same as the per-role tile it replaces).
   *   - `pending`: occurrences still awaiting someone's action that have no
   *     confirmation at all (unbounded — a stale pending row auto-expires).
   */
  async getOrgCompletionSummary(
    authUserId: string,
    params: {
      orgId: string;
      completedSince?: string | null;
      completedUntil?: string | null;
    },
  ): Promise<{ completed: number; pending: number }> {
    if (!params?.orgId || !isUuid(params.orgId)) {
      throw new BadRequestException('Invalid orgId');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, params.orgId);
    await this.assertAdminAccess(supabase, account, params.orgId);

    // Aggregated in Postgres (get_org_session_completion_summary): the org-wide,
    // all-time pending set is unbounded, so folding raw rows in Node here used
    // to scan the whole table and trip statement_timeout on large orgs.
    const response = await supabase.rpc('get_org_session_completion_summary', {
      p_org_id: params.orgId,
      p_since: params.completedSince ?? null,
      p_until: params.completedUntil ?? null,
    });

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }

    const row = (
      (response.data ?? []) as Array<{ completed: number; pending: number }>
    )[0];
    return { completed: row?.completed ?? 0, pending: row?.pending ?? 0 };
  }

  /**
   * Cross-party completion state for a classroom channel's Sessions tab. RLS on
   * class_session_completions only exposes a viewer's own rows, so this reads
   * through the service client after verifying the caller is a member of the
   * channel. Role is not filtered — mirroring the "either party" rule the tab
   * presents:
   *   - `completions`: any participant confirmed it ('confirmed'/'auto_confirmed').
   *   - `disputed`: any participant filed a dispute ('disputed'). The tab treats an
   *     elapsed session as complete unless it appears here.
   */
  async listChannelCompletionStates(
    authUserId: string,
    params: { orgId: string; channelId: string },
  ): Promise<{
    completions: ChannelSessionCompletionVM[];
    disputed: ChannelSessionCompletionVM[];
  }> {
    if (!params?.orgId || !isUuid(params.orgId)) {
      throw new BadRequestException('Invalid orgId');
    }
    if (!params?.channelId || !isUuid(params.channelId)) {
      throw new BadRequestException('Invalid channelId');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, params.orgId);
    await this.assertChannelMember(supabase, account, params.orgId, params.channelId);

    const { data, error } = await supabase
      .from('class_session_completions')
      .select('schedule_id, occurrence_key, status')
      .eq('org_id', params.orgId)
      .eq('channel_id', params.channelId)
      .in('status', ['confirmed', 'auto_confirmed', 'disputed'])
      .is('deleted_at', null)
      .returns<Array<{ schedule_id: string; occurrence_key: string; status: string }>>();

    if (error) throw new InternalServerErrorException(error.message);

    const seen = { completed: new Set<string>(), disputed: new Set<string>() };
    const completions: ChannelSessionCompletionVM[] = [];
    const disputed: ChannelSessionCompletionVM[] = [];
    for (const row of data ?? []) {
      const key = `${row.schedule_id}|${row.occurrence_key}`;
      const bucket = row.status === 'disputed' ? 'disputed' : 'completed';
      if (seen[bucket].has(key)) continue;
      seen[bucket].add(key);
      (bucket === 'disputed' ? disputed : completions).push({
        scheduleId: row.schedule_id,
        occurrenceKey: row.occurrence_key,
      });
    }

    return { completions, disputed };
  }

  async confirm(authUserId: string, body: ConfirmSessionCompletionInput) {
    const row = await this.loadOwnedRow(authUserId, body.orgId, body.sessionCompletionId);
    if (row.status !== 'pending') {
      // The session is no longer awaiting this person's response. Confirming an
      // already-complete session is idempotent — it was auto-confirmed by the
      // system, or confirmed from another device/tab. Report success (with a
      // flag) so a client showing a stale prompt can switch to the completed
      // state instead of surfacing a confusing error.
      if (row.status === 'confirmed' || row.status === 'auto_confirmed') {
        return {
          success: true,
          alreadyResolved: true,
          status: row.status,
          feedbackEnabled: true,
        };
      }
      // row.status === 'disputed'
      throw new ConflictException(
        "This session was already reported as having a problem, so it can't be " +
          'marked complete. Ask an admin if that needs to change.',
      );
    }

    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('class_session_completions')
      .update({
        status: 'confirmed',
        confirmed_at: now,
        resolved_at: now,
        updated_at: now,
        updated_by: row.profile_id,
      })
      .eq('id', row.id)
      .eq('org_id', body.orgId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!updated) {
      // Lost a race: another device resolved this row between our read and our
      // write. Re-read to see who won — confirming on top of a confirm is an
      // idempotent success, but a dispute must still surface as a conflict rather
      // than a fake "completed" state that would show completion/rating UI.
      const { data: current, error: rereadError } = await supabase
        .from('class_session_completions')
        .select('status')
        .eq('id', row.id)
        .eq('org_id', body.orgId)
        .is('deleted_at', null)
        .maybeSingle<{ status: string }>();

      if (rereadError) throw new InternalServerErrorException(rereadError.message);
      if (current?.status === 'confirmed' || current?.status === 'auto_confirmed') {
        return {
          success: true,
          alreadyResolved: true,
          status: current.status,
          feedbackEnabled: true,
        };
      }
      if (current?.status === 'disputed') {
        throw new ConflictException(
          "This session was already reported as having a problem, so it can't be " +
            'marked complete. Ask an admin if that needs to change.',
        );
      }
      throw new ConflictException('Session completion was already resolved');
    }

    this.logger.log(
      `session completion confirmed id=${row.id} profileId=${row.profile_id}`,
    );
    await this.markRelatedActivityFeedItemsRead(supabase, body.orgId, row);
    return { success: true, feedbackEnabled: true };
  }

  async dispute(authUserId: string, body: DisputeSessionCompletionInput) {
    if (!DISPUTE_CATEGORIES.includes(body.disputeCategory)) {
      throw new BadRequestException('Invalid disputeCategory');
    }
    const disputeReason = normalizeText(body.disputeReason, 500);

    const row = await this.loadOwnedRow(authUserId, body.orgId, body.sessionCompletionId);
    if (row.status !== 'pending') {
      throw new ConflictException(
        row.status === 'disputed'
          ? "You've already reported a problem with this session."
          : "This session has already been marked complete, so a problem can't be " +
              'reported for it here. Ask an admin if you need to change that.',
      );
    }

    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('class_session_completions')
      .update({
        status: 'disputed',
        dispute_category: body.disputeCategory,
        dispute_reason: disputeReason,
        reschedule_requested: body.rescheduleRequested ?? false,
        disputed_at: now,
        resolved_at: now,
        updated_at: now,
        updated_by: row.profile_id,
      })
      .eq('id', row.id)
      .eq('org_id', body.orgId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!updated) {
      throw new ConflictException(
        'This session was just updated from another device — refresh to see its ' +
          'current status.',
      );
    }

    this.logger.log(
      `session completion disputed id=${row.id} profileId=${row.profile_id}`,
    );

    await this.publishDisputeNotifications({
      supabase,
      row,
      disputeCategory: body.disputeCategory,
      disputeReason,
      rescheduleRequested: body.rescheduleRequested ?? false,
    });
    await this.markRelatedActivityFeedItemsRead(supabase, body.orgId, row);

    return { success: true, feedbackEnabled: false };
  }

  /**
   * Reverts a just-confirmed or just-disputed row back to 'pending', mirroring the
   * short "Edit rating" window ActivityFeedbackRequest already offers after a rating
   * — same idea, applied to confirm/dispute. Enforced server-side (not just a hidden
   * client button) via resolved_at age, so a stale client can't call this after the
   * window the UI showed has closed.
   */
  async undo(authUserId: string, body: UndoSessionCompletionInput) {
    const row = await this.loadOwnedRow(authUserId, body.orgId, body.sessionCompletionId);

    if (row.status !== 'confirmed' && row.status !== 'disputed') {
      throw new BadRequestException(
        `Cannot undo a session completion in status '${row.status}'`,
      );
    }
    if (row.rating !== null && row.rating !== undefined) {
      throw new BadRequestException('Cannot undo after a rating has been submitted');
    }

    const resolvedAtMs = row.resolved_at
      ? new Date(row.resolved_at).getTime()
      : Number.NaN;
    if (!Number.isFinite(resolvedAtMs) || Date.now() - resolvedAtMs > UNDO_WINDOW_MS) {
      throw new BadRequestException('Undo window has expired');
    }

    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('class_session_completions')
      .update({
        status: 'pending',
        confirmed_at: null,
        disputed_at: null,
        resolved_at: null,
        dispute_category: null,
        dispute_reason: null,
        reschedule_requested: false,
        updated_at: now,
        updated_by: row.profile_id,
      })
      .eq('id', row.id)
      .eq('org_id', body.orgId)
      .eq('status', row.status)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!updated) {
      throw new ConflictException(
        'Session completion state changed before undo could be applied',
      );
    }

    this.logger.log(
      `session completion undone id=${row.id} previousStatus=${row.status}`,
    );
    return { success: true };
  }

  async rate(authUserId: string, body: RateSessionCompletionInput) {
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      throw new BadRequestException('rating must be an integer between 1 and 5');
    }
    const comment = normalizeText(body.comment, 1000);

    const row = await this.loadOwnedRow(authUserId, body.orgId, body.sessionCompletionId);
    if (row.status !== 'confirmed' && row.status !== 'auto_confirmed') {
      throw new BadRequestException(
        `Cannot rate a session completion in status '${row.status}'`,
      );
    }

    const supabase = createSupabaseServiceClient();

    if (row.learning_space_id) {
      const { data: classroom, error: classroomError } = await supabase
        .from('learning_spaces')
        .select('status, archived_at')
        .eq('org_id', body.orgId)
        .eq('id', row.learning_space_id)
        .is('deleted_at', null)
        .maybeSingle<{ status: string | null; archived_at: string | null }>();

      if (classroomError) throw new InternalServerErrorException(classroomError.message);

      const archivedAt = classroom?.archived_at ?? null;
      if (archivedAt || classroom?.status === 'archived') {
        const archivedMs = archivedAt ? new Date(archivedAt).getTime() : Number.NaN;
        const occurrenceMs = new Date(row.occurrence_key).getTime();
        if (!Number.isFinite(archivedMs) || occurrenceMs > archivedMs) {
          throw new ForbiddenException(
            'Archived classrooms cannot receive feedback for future sessions',
          );
        }
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('class_session_completions')
      .update({
        rating: body.rating,
        rating_comment: comment,
        rated_at: now,
        updated_at: now,
        updated_by: row.profile_id,
      })
      .eq('id', row.id)
      .eq('org_id', body.orgId)
      .in('status', ['confirmed', 'auto_confirmed'])
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!updated) {
      throw new ConflictException('Session completion can no longer be rated');
    }

    this.logger.log(`session completion rated id=${row.id} rating=${body.rating}`);
    await this.markRelatedActivityFeedItemsRead(supabase, body.orgId, row);
    return { success: true };
  }

  /**
   * The viewer confirmed the session but is closing the rating prompt without
   * scoring it ("not voted"). Stamps `rated_at` with `rating` left null so the
   * homepage carousel and the completed-sessions list stop surfacing it — the
   * session still counts as completed, it just has no feedback and won't come
   * back on the next fetch.
   */
  async skipRating(authUserId: string, body: SkipSessionCompletionRatingInput) {
    const row = await this.loadOwnedRow(authUserId, body.orgId, body.sessionCompletionId);
    if (row.status !== 'confirmed' && row.status !== 'auto_confirmed') {
      throw new BadRequestException(
        `Cannot skip rating for a session completion in status '${row.status}'`,
      );
    }
    // Already resolved (a real rating, or a previous skip) — nothing to do.
    if (row.rating != null || row.rated_at != null) {
      return { success: true, alreadyResolved: true };
    }

    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('class_session_completions')
      .update({
        rated_at: now,
        updated_at: now,
        updated_by: row.profile_id,
      })
      .eq('id', row.id)
      .eq('org_id', body.orgId)
      .in('status', ['confirmed', 'auto_confirmed'])
      .is('rated_at', null)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!updated) {
      // Lost a race with a real rating or a concurrent skip — the outcome the
      // caller wanted (no longer awaiting a vote) already holds.
      return { success: true, alreadyResolved: true };
    }

    this.logger.log(
      `session completion rating skipped id=${row.id} profileId=${row.profile_id}`,
    );
    await this.markRelatedActivityFeedItemsRead(supabase, body.orgId, row);
    return { success: true };
  }

  /**
   * Best-effort sync: resolving a completion check from ANY surface (the
   * homepage tile or the notification-feed card — both drive the same
   * confirm/dispute/rate endpoints) should mark the notification(s) that
   * announced it as read, so it doesn't linger unread in the inbox just
   * because the user never opened the Notifications tab. A completion-check
   * notification's `metadata.sessionCompletionId` (single-session dispatch) or
   * `metadata.sessions[].sessionCompletionId` (guardian batch dispatch) is
   * what ties it back to this row — see completion-check-dispatcher.service.ts.
   * Failures here are logged, not thrown: this must never block the actual
   * confirm/dispute/rate action from succeeding.
   */
  private async markRelatedActivityFeedItemsRead(
    supabase: SupabaseServiceClient,
    orgId: string,
    row: ClassSessionCompletionRow,
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('activity_feed_items')
        .select('id, metadata')
        .eq('org_id', orgId)
        .eq('recipient_profile_id', row.profile_id)
        .eq('is_read', false)
        .is('deleted_at', null)
        .in('verb', [
          'session.completion_check.sent',
          'session.completion_check.batch.sent',
        ])
        .returns<Array<{ id: string; metadata: Record<string, unknown> | null }>>();

      if (error) throw new Error(error.message);

      const matchingIds = (data ?? [])
        .filter((item) => {
          const metadata = item.metadata ?? {};
          if (metadata.sessionCompletionId === row.id) return true;
          const sessions = Array.isArray(metadata.sessions) ? metadata.sessions : [];
          return sessions.some(
            (session) =>
              session &&
              typeof session === 'object' &&
              (session as Record<string, unknown>).sessionCompletionId === row.id,
          );
        })
        .map((item) => item.id);

      if (!matchingIds.length) return;

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('activity_feed_items')
        .update({ is_read: true, read_at: now, updated_at: now })
        .eq('org_id', orgId)
        .in('id', matchingIds);

      if (updateError) throw new Error(updateError.message);
    } catch (err) {
      this.logger.warn(
        `failed to mark notifications read for sessionCompletionId=${row.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async loadOwnedRow(
    authUserId: string,
    orgId: string,
    sessionCompletionId: string,
  ): Promise<ClassSessionCompletionRow> {
    if (!orgId || !isUuid(orgId)) throw new BadRequestException('Invalid orgId');
    if (!sessionCompletionId || !isUuid(sessionCompletionId)) {
      throw new BadRequestException('Invalid sessionCompletionId');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, orgId);

    const { data: row, error } = await supabase
      .from('class_session_completions')
      .select('*')
      .eq('id', sessionCompletionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<ClassSessionCompletionRow>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!row) throw new NotFoundException('Session completion not found');

    await this.resolvePermittedProfile(supabase, account, orgId, row.profile_id);
    return row;
  }

  /** Verifies the requesting account has a membership row in the given channel. */
  private async assertChannelMember(
    supabase: SupabaseServiceClient,
    account: AccountRow,
    orgId: string,
    channelId: string,
  ): Promise<void> {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', account.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    if (profilesError) throw new InternalServerErrorException(profilesError.message);

    const profileIds = (profiles ?? []).map((profile) => profile.id);
    if (!profileIds.length) throw new ForbiddenException('Forbidden');

    const { data: membership, error: membershipError } = await supabase
      .from('channel_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('channel_id', channelId)
      .in('profile_id', profileIds)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (membershipError) throw new InternalServerErrorException(membershipError.message);
    if (!membership) throw new ForbiddenException('Forbidden');
  }

  private async resolveAccount(
    supabase: SupabaseServiceClient,
    authUserId: string,
    orgId: string,
  ): Promise<AccountRow> {
    const { data: account, error } = await supabase
      .from('accounts')
      .select('id, org_id')
      .eq('auth_user_id', authUserId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<AccountRow>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  /** Verifies the requesting account may act as targetProfileId (itself, or a linked child). */
  private async resolvePermittedProfile(
    supabase: SupabaseServiceClient,
    account: AccountRow,
    orgId: string,
    targetProfileId: string,
  ): Promise<ProfileRow> {
    const { data: targetProfile, error } = await supabase
      .from('profiles')
      .select('id, account_id, org_id, kind')
      .eq('id', targetProfileId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<ProfileRow>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!targetProfile) throw new NotFoundException('Profile not found');
    if (targetProfile.account_id === account.id) return targetProfile;

    const { data: familyLink, error: familyLinkError } = await supabase
      .from('family_links')
      .select('child_account_id')
      .eq('org_id', orgId)
      .eq('guardian_account_id', account.id)
      .eq('child_account_id', targetProfile.account_id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ child_account_id: string }>();

    if (familyLinkError) throw new InternalServerErrorException(familyLinkError.message);
    if (!familyLink) throw new ForbiddenException('Forbidden');
    return targetProfile;
  }

  private async assertAdminAccess(
    supabase: SupabaseServiceClient,
    account: AccountRow,
    orgId: string,
  ) {
    const [roleResponse, accountResponse] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role_key')
        .eq('org_id', orgId)
        .eq('account_id', account.id)
        .in('role_key', ['owner', 'admin', 'staff'])
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle<{ role_key: string }>(),
      supabase
        .from('accounts')
        .select('id')
        .eq('id', account.id)
        .eq('org_id', orgId)
        .in('primary_role', ['owner', 'admin', 'staff'])
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle<{ id: string }>(),
    ]);

    if (roleResponse.error) {
      throw new InternalServerErrorException(roleResponse.error.message);
    }
    if (accountResponse.error) {
      throw new InternalServerErrorException(accountResponse.error.message);
    }
    if (!roleResponse.data && !accountResponse.data) {
      throw new ForbiddenException('Forbidden');
    }
  }

  private async publishDisputeNotifications(input: {
    supabase: SupabaseServiceClient;
    row: ClassSessionCompletionRow;
    disputeCategory: string;
    disputeReason: string | null;
    rescheduleRequested: boolean;
  }) {
    const { supabase, row, disputeCategory, disputeReason, rescheduleRequested } = input;

    const { data: reporterProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', row.profile_id)
      .eq('org_id', row.org_id)
      .is('deleted_at', null)
      .maybeSingle<{ display_name: string | null }>();

    const { data: educators } = await supabase
      .from('class_schedule_participants')
      .select('display_name')
      .eq('org_id', row.org_id)
      .eq('schedule_id', row.schedule_id)
      .eq('role', 'educator')
      .is('deleted_at', null)
      .returns<Array<{ display_name: string | null }>>();

    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', row.org_id)
      .eq('kind', 'staff')
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    const staffIds = (staffProfiles ?? []).map((p) => p.id);
    if (!staffIds.length) return;

    const scope = row.learning_space_id
      ? { kind: 'learning_space' as const, learningSpaceId: row.learning_space_id }
      : { kind: 'channel' as const, channelId: row.channel_id ?? '' };

    await publishActivityEvent({
      supabase,
      orgId: row.org_id,
      eventType: 'session.completion.dispute_reported',
      sourceKind: 'system',
      scope,
      objectRef: { kind: 'session', id: row.schedule_id },
      audienceRules: [{ kind: 'users_only', userIds: staffIds }],
      payload: {
        channelId: row.channel_id ?? '',
        learningSpaceId: row.learning_space_id ?? null,
        scheduleId: row.schedule_id,
        occurrenceStart: row.occurrence_key,
        title: row.session_title,
        sessionCompletionId: row.id,
        reportedByProfileId: row.profile_id,
        reportedByDisplayName: reporterProfile?.display_name ?? 'Unknown',
        reportedByRole: row.role,
        disputeCategory,
        disputeReason,
        rescheduleRequested,
        recipientRole: 'staff',
        educatorNames: (educators ?? [])
          .map((e) => e.display_name ?? 'Unknown')
          .join(', '),
      },
      dedupeKey: `dispute:${row.schedule_id}:${row.occurrence_key}:staff:${row.profile_id}`,
      refreshOnDedupe: true,
    });
  }

  private encodeCursor(orderKey: string, id: string) {
    return Buffer.from(JSON.stringify({ orderKey, id }), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): { orderKey: string; id: string } {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        orderKey?: string;
        id?: string;
      };
      if (
        !decoded.orderKey ||
        !decoded.id ||
        !Number.isFinite(Date.parse(decoded.orderKey)) ||
        !isUuid(decoded.id)
      ) {
        throw new Error('malformed cursor');
      }
      return { orderKey: decoded.orderKey, id: decoded.id };
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  /**
   * Staff override for a whole occurrence: settles every still-open (pending or
   * auto_confirmed) participant row at once, rather than the single owned row
   * `confirm()` handles. Unlike `confirm()`, the caller need not be a party to
   * the session — authorization is admin-role-based (`assertAdminAccess`), the
   * same gate `listForAdmin` uses. Flipping status away from 'pending' is what
   * stops the teacher/parent prompt from resurfacing: their own `confirm()` call
   * (or the mobile prompt driving it) treats a non-pending row as already
   * resolved, and the completion-check reminder job only ever targets pending
   * rows.
   */
  async adminConfirm(authUserId: string, body: AdminConfirmSessionCompletionInput) {
    if (!body?.orgId || !isUuid(body.orgId)) {
      throw new BadRequestException('Invalid orgId');
    }
    if (!body?.scheduleId || !isUuid(body.scheduleId)) {
      throw new BadRequestException('Invalid scheduleId');
    }
    if (!body?.occurrenceKey || !Number.isFinite(Date.parse(body.occurrenceKey))) {
      throw new BadRequestException('Invalid occurrenceKey');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, body.orgId);
    await this.assertAdminAccess(supabase, account, body.orgId);

    const { data: rows, error } = await supabase
      .from('class_session_completions')
      .select('*')
      .eq('org_id', body.orgId)
      .eq('schedule_id', body.scheduleId)
      .eq('occurrence_key', body.occurrenceKey)
      .is('deleted_at', null)
      .returns<ClassSessionCompletionRow[]>();

    if (error) throw new InternalServerErrorException(error.message);
    if (!rows?.length) throw new NotFoundException('Session completion not found');

    if (rows.some((row) => row.status === 'disputed')) {
      throw new ConflictException(
        "This session has an open dispute, so it can't be confirmed here. " +
          'Resolve the dispute first.',
      );
    }

    const openRows = rows.filter(
      (row) => row.status === 'pending' || row.status === 'auto_confirmed',
    );
    if (!openRows.length) {
      return { success: true, alreadyResolved: true, confirmedCount: 0 };
    }

    const { data: staffProfile, error: staffProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', account.id)
      .eq('org_id', body.orgId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (staffProfileError)
      throw new InternalServerErrorException(staffProfileError.message);

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('class_session_completions')
      .update({
        status: 'confirmed',
        confirmed_at: now,
        resolved_at: now,
        updated_at: now,
        updated_by: staffProfile?.id ?? account.id,
      })
      .in(
        'id',
        openRows.map((row) => row.id),
      )
      .eq('org_id', body.orgId)
      .in('status', ['pending', 'auto_confirmed'])
      .select('id')
      .returns<Array<{ id: string }>>();

    if (updateError) throw new InternalServerErrorException(updateError.message);

    this.logger.log(
      `session completion admin-confirmed scheduleId=${body.scheduleId} ` +
        `occurrenceKey=${body.occurrenceKey} count=${updated?.length ?? 0}`,
    );

    await Promise.all(
      openRows.map((row) =>
        this.markRelatedActivityFeedItemsRead(supabase, body.orgId, row),
      ),
    );

    return { success: true, confirmedCount: updated?.length ?? 0 };
  }

  /**
   * Soft-deletes a wrong/erroneous admin submission — either one participant's
   * row (profileId given) or every row for the occurrence (profileId omitted),
   * for cleaning up a bad entry rather than resolving a real one.
   */
  async adminDeleteSubmission(
    authUserId: string,
    body: AdminDeleteSessionCompletionInput,
  ): Promise<{ success: true; deletedCount: number }> {
    if (!body?.orgId || !isUuid(body.orgId)) {
      throw new BadRequestException('Invalid orgId');
    }
    if (!body?.scheduleId || !isUuid(body.scheduleId)) {
      throw new BadRequestException('Invalid scheduleId');
    }
    if (!body?.occurrenceKey || !Number.isFinite(Date.parse(body.occurrenceKey))) {
      throw new BadRequestException('Invalid occurrenceKey');
    }
    if (body.profileId && !isUuid(body.profileId)) {
      throw new BadRequestException('Invalid profileId');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, body.orgId);
    await this.assertAdminAccess(supabase, account, body.orgId);

    const { data: staffProfile, error: staffProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', account.id)
      .eq('org_id', body.orgId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (staffProfileError) {
      throw new InternalServerErrorException(staffProfileError.message);
    }

    const now = new Date().toISOString();
    const deletedBy = staffProfile?.id ?? account.id;
    const baseQuery = supabase
      .from('class_session_completions')
      .update({
        deleted_at: now,
        deleted_by: deletedBy,
        updated_at: now,
        updated_by: deletedBy,
      })
      .eq('org_id', body.orgId)
      .eq('schedule_id', body.scheduleId)
      .eq('occurrence_key', body.occurrenceKey)
      .is('deleted_at', null);
    const query = body.profileId ? baseQuery.eq('profile_id', body.profileId) : baseQuery;

    const { data: deleted, error } = await query
      .select('id')
      .returns<Array<{ id: string }>>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!deleted?.length) throw new NotFoundException('Session completion not found');

    this.logger.log(
      `session completion admin-deleted scheduleId=${body.scheduleId} ` +
        `occurrenceKey=${body.occurrenceKey} profileId=${body.profileId ?? 'all'} ` +
        `count=${deleted.length}`,
    );

    return { success: true, deletedCount: deleted.length };
  }

  /**
   * Every org profile of the given kind, for the admin "Filter by participant"
   * teacher/parent dropdowns — sourced from the users roster directly rather than
   * derived from whichever completions happen to be loaded, so a teacher/parent
   * with zero completions in the current window is still selectable.
   */
  async listOrgRosterForAdmin(
    authUserId: string,
    params: { orgId: string; kind: 'educator' | 'guardian' },
  ): Promise<AdminOrgProfileOptionVM[]> {
    if (!params?.orgId || !isUuid(params.orgId)) {
      throw new BadRequestException('Invalid orgId');
    }
    if (params.kind !== 'educator' && params.kind !== 'guardian') {
      throw new BadRequestException('Invalid kind');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, params.orgId);
    await this.assertAdminAccess(supabase, account, params.orgId);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name')
      .eq('org_id', params.orgId)
      .eq('kind', params.kind)
      .is('deleted_at', null)
      .returns<
        Array<{
          id: string;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
        }>
      >();
    if (error) throw new InternalServerErrorException(error.message);

    return (data ?? [])
      .map((profile) => ({
        profileId: profile.id,
        displayName:
          profile.display_name?.trim() ||
          [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
          (params.kind === 'educator' ? 'Tutor' : 'Parent'),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async listForAdmin(
    authUserId: string,
    params: {
      orgId: string;
      completedSince?: string | null;
      completedUntil?: string | null;
    },
  ): Promise<AdminSessionCompletionVM[]> {
    if (!params?.orgId || !isUuid(params.orgId)) {
      throw new BadRequestException('Invalid orgId');
    }

    const supabase = createSupabaseServiceClient();
    const account = await this.resolveAccount(supabase, authUserId, params.orgId);
    await this.assertAdminAccess(supabase, account, params.orgId);

    // Clamp every admin read to the rolling three-month reporting window,
    // including callers that omit bounds or request an older month.
    const now = new Date();
    const earliest = new Date(now);
    earliest.setUTCDate(1);
    earliest.setUTCMonth(earliest.getUTCMonth() - 3);
    const lastDay = new Date(
      Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth() + 1, 0),
    ).getUTCDate();
    earliest.setUTCDate(Math.min(now.getUTCDate(), lastDay));
    const requestedSince = params.completedSince
      ? Date.parse(params.completedSince)
      : earliest.getTime();
    const requestedUntil = params.completedUntil
      ? Date.parse(params.completedUntil)
      : now.getTime();
    if (
      !Number.isFinite(requestedSince) ||
      !Number.isFinite(requestedUntil) ||
      requestedSince >= requestedUntil
    ) {
      throw new BadRequestException('Invalid completion date range');
    }
    const since = Math.max(earliest.getTime(), requestedSince);
    const until = Math.min(now.getTime(), requestedUntil);
    if (since >= until) return [];

    // Read all recipient states so pending people contribute to the denominator.
    // Page through the rows to avoid truncating totals at the Data API row limit.
    const completionRows: ClassSessionCompletionRow[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('class_session_completions')
        .select('*')
        .eq('org_id', params.orgId)
        .is('deleted_at', null)
        .gte('session_end_at', new Date(since).toISOString())
        .lt('session_end_at', new Date(until).toISOString())
        .order('session_end_at', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1)
        .returns<ClassSessionCompletionRow[]>();
      if (error) throw new InternalServerErrorException(error.message);
      completionRows.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
    }
    const profileIds = [...new Set(completionRows.map((row) => row.profile_id))];
    const scheduleIds = [...new Set(completionRows.map((row) => row.schedule_id))];
    const learningSpaceIds = [
      ...new Set(
        completionRows
          .map((row) => row.learning_space_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [profileResponse, participantResponse, learningSpaceResponse] =
      await Promise.all([
        profileIds.length
          ? supabase
              .from('profiles')
              .select('id, display_name, first_name, last_name')
              .eq('org_id', params.orgId)
              .in('id', profileIds)
              .is('deleted_at', null)
              .returns<
                Array<{
                  id: string;
                  display_name: string | null;
                  first_name: string | null;
                  last_name: string | null;
                }>
              >()
          : Promise.resolve({ data: [], error: null }),
        // Include tutors who have not confirmed, as well as students and parents.
        scheduleIds.length
          ? supabase
              .from('class_schedule_participants')
              .select('schedule_id, profile_id, role, display_name')
              .eq('org_id', params.orgId)
              .in('schedule_id', scheduleIds)
              .in('role', ['child', 'guardian', 'educator'])
              .is('deleted_at', null)
              .returns<
                Array<{
                  schedule_id: string;
                  profile_id: string;
                  role: string;
                  display_name: string | null;
                }>
              >()
          : Promise.resolve({ data: [], error: null }),
        learningSpaceIds.length
          ? supabase
              .from('learning_spaces')
              .select('id, title')
              .eq('org_id', params.orgId)
              .in('id', learningSpaceIds)
              .returns<Array<{ id: string; title: string | null }>>()
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (profileResponse.error) {
      throw new InternalServerErrorException(profileResponse.error.message);
    }
    if (participantResponse.error) {
      throw new InternalServerErrorException(participantResponse.error.message);
    }
    if (learningSpaceResponse.error) {
      throw new InternalServerErrorException(learningSpaceResponse.error.message);
    }
    const names = new Map(
      (profileResponse.data ?? []).map((profile) => [
        profile.id,
        profile.display_name?.trim() ||
          [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
          'Unknown user',
      ]),
    );
    const learningSpaceTitles = new Map(
      (learningSpaceResponse.data ?? []).map((space) => [
        space.id,
        space.title?.trim() || null,
      ]),
    );
    const studentNamesByScheduleId = new Map<string, string[]>();
    const guardiansByScheduleId = new Map<string, AdminSessionCompletionGuardianVM[]>();
    const educatorsByScheduleId = new Map<string, AdminSessionCompletionGuardianVM[]>();
    const childProfileIdsByScheduleId = new Map<string, string[]>();
    const addGuardian = (
      scheduleId: string,
      guardian: AdminSessionCompletionGuardianVM,
    ) => {
      const values = guardiansByScheduleId.get(scheduleId) ?? [];
      if (!values.some((existing) => existing.profileId === guardian.profileId)) {
        values.push(guardian);
      }
      guardiansByScheduleId.set(scheduleId, values);
    };
    (participantResponse.data ?? []).forEach((participant) => {
      const displayName = participant.display_name?.trim();
      if (participant.role === 'educator') {
        const educators = educatorsByScheduleId.get(participant.schedule_id) ?? [];
        educators.push({
          profileId: participant.profile_id,
          displayName: displayName || 'Tutor',
        });
        educatorsByScheduleId.set(participant.schedule_id, educators);
        return;
      }
      if (participant.role === 'guardian') {
        addGuardian(participant.schedule_id, {
          profileId: participant.profile_id,
          displayName: displayName || 'Parent',
        });
        return;
      }
      const childIds = childProfileIdsByScheduleId.get(participant.schedule_id) ?? [];
      if (!childIds.includes(participant.profile_id))
        childIds.push(participant.profile_id);
      childProfileIdsByScheduleId.set(participant.schedule_id, childIds);
      if (!displayName) return;
      const values = studentNamesByScheduleId.get(participant.schedule_id) ?? [];
      if (!values.includes(displayName)) values.push(displayName);
      studentNamesByScheduleId.set(participant.schedule_id, values);
    });

    // Guardians are often not explicit schedule participants — the completion
    // prompt itself reaches them through `family_links` off the child. Mirror
    // that resolution here so the admin "Parent" filter can surface a parent for
    // every session their kid sat in, even ones only the teacher confirmed.
    const childProfileIds = [
      ...new Set([...childProfileIdsByScheduleId.values()].flat()),
    ];
    if (childProfileIds.length) {
      const { data: childProfiles, error: childProfilesError } = await supabase
        .from('profiles')
        .select('id, account_id, kind')
        .eq('org_id', params.orgId)
        .in('id', childProfileIds)
        .is('deleted_at', null)
        .returns<Array<{ id: string; account_id: string; kind: string | null }>>();
      if (childProfilesError) {
        throw new InternalServerErrorException(childProfilesError.message);
      }
      const childAccountIdByProfileId = new Map(
        (childProfiles ?? [])
          .filter((profile) => profile.kind === 'child')
          .map((profile) => [profile.id, profile.account_id]),
      );
      const childAccountIds = [...new Set(childAccountIdByProfileId.values())];

      if (childAccountIds.length) {
        const { data: familyLinks, error: familyLinksError } = await supabase
          .from('family_links')
          .select('guardian_account_id, child_account_id')
          .eq('org_id', params.orgId)
          .in('child_account_id', childAccountIds)
          .is('deleted_at', null)
          .returns<Array<{ guardian_account_id: string; child_account_id: string }>>();
        if (familyLinksError) {
          throw new InternalServerErrorException(familyLinksError.message);
        }
        const guardianAccountIds = [
          ...new Set((familyLinks ?? []).map((link) => link.guardian_account_id)),
        ];

        if (guardianAccountIds.length) {
          const { data: guardianProfiles, error: guardianProfilesError } = await supabase
            .from('profiles')
            .select('id, account_id, display_name, first_name, last_name')
            .eq('org_id', params.orgId)
            .in('account_id', guardianAccountIds)
            .is('deleted_at', null)
            .returns<
              Array<{
                id: string;
                account_id: string;
                display_name: string | null;
                first_name: string | null;
                last_name: string | null;
              }>
            >();
          if (guardianProfilesError) {
            throw new InternalServerErrorException(guardianProfilesError.message);
          }
          const guardianByAccountId = new Map(
            (guardianProfiles ?? []).map((profile) => [
              profile.account_id,
              {
                profileId: profile.id,
                displayName:
                  profile.display_name?.trim() ||
                  [profile.first_name, profile.last_name]
                    .filter(Boolean)
                    .join(' ')
                    .trim() ||
                  'Parent',
              },
            ]),
          );
          const guardiansByChildAccountId = new Map<
            string,
            AdminSessionCompletionGuardianVM[]
          >();
          (familyLinks ?? []).forEach((link) => {
            const guardian = guardianByAccountId.get(link.guardian_account_id);
            if (!guardian) return;
            const values = guardiansByChildAccountId.get(link.child_account_id) ?? [];
            if (!values.some((existing) => existing.profileId === guardian.profileId)) {
              values.push(guardian);
            }
            guardiansByChildAccountId.set(link.child_account_id, values);
          });

          childProfileIdsByScheduleId.forEach((profileIdsForSchedule, scheduleId) => {
            profileIdsForSchedule.forEach((childProfileId) => {
              const childAccountId = childAccountIdByProfileId.get(childProfileId);
              if (!childAccountId) return;
              (guardiansByChildAccountId.get(childAccountId) ?? []).forEach((guardian) =>
                addGuardian(scheduleId, guardian),
              );
            });
          });
        }
      }
    }

    const grouped = new Map<string, ClassSessionCompletionRow[]>();
    completionRows.forEach((row) => {
      const key = `${row.schedule_id}|${row.occurrence_key}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(row);
      grouped.set(key, bucket);
    });

    return [...grouped.entries()].map(([id, rows]) => {
      const first = rows[0]!;
      // Every recipient row, whether or not it has confirmed — occurrences still
      // awaiting confirmation or under dispute are shown, not just completed ones.
      const confirmedActors: AdminSessionCompletionActorVM[] = rows
        .filter((row) => row.status === 'confirmed' || row.status === 'auto_confirmed')
        .map((row) => ({
          profileId: row.profile_id,
          displayName: names.get(row.profile_id) ?? 'Unknown user',
          role: row.role,
          status: row.status as AdminSessionCompletionActorVM['status'],
          completedAt: row.resolved_at ?? row.confirmed_at ?? row.updated_at,
        }));
      const methods = new Set(confirmedActors.map((actor) => actor.status));
      const hasDispute = rows.some((row) => row.status === 'disputed');
      const completionMethod: AdminSessionCompletionVM['completionMethod'] =
        confirmedActors.length === 0
          ? hasDispute
            ? 'disputed'
            : 'pending'
          : methods.size > 1
            ? 'mixed'
            : confirmedActors[0]!.status;
      const ratings = rows
        .map((row) => row.rating)
        .filter((rating): rating is number => typeof rating === 'number');

      // Include every guardian recipient, even if absent from the current
      // roster/family links or still awaiting confirmation.
      const guardians: AdminSessionCompletionGuardianVM[] = [
        ...(guardiansByScheduleId.get(first.schedule_id) ?? []),
      ];
      rows
        .filter((row) => row.role === 'guardian')
        .forEach((row) => {
          if (!guardians.some((guardian) => guardian.profileId === row.profile_id)) {
            guardians.push({
              profileId: row.profile_id,
              displayName: names.get(row.profile_id) ?? 'Parent',
            });
          }
        });

      const participants = new Map<string, AdminSessionCompletionParticipantVM>();
      const addParticipant = (
        person: AdminSessionCompletionGuardianVM,
        role: 'educator' | 'guardian',
      ) => {
        participants.set(`${role}|${person.profileId}`, {
          ...person,
          role,
          status: 'pending',
          rating: null,
        });
      };
      (educatorsByScheduleId.get(first.schedule_id) ?? []).forEach((person) =>
        addParticipant(person, 'educator'),
      );
      guardians.forEach((person) => addParticipant(person, 'guardian'));
      rows.forEach((row) => {
        if (row.role !== 'educator' && row.role !== 'guardian') return;
        const key = `${row.role}|${row.profile_id}`;
        participants.set(key, {
          profileId: row.profile_id,
          displayName:
            names.get(row.profile_id) ??
            participants.get(key)?.displayName ??
            'Unknown user',
          role: row.role,
          status: row.status,
          rating: row.rating ?? null,
        });
      });

      return {
        id,
        orgId: first.org_id,
        scheduleId: first.schedule_id,
        occurrenceKey: first.occurrence_key,
        sessionEndAt: first.session_end_at,
        sessionTitle: first.session_title ?? null,
        studentNames: studentNamesByScheduleId.get(first.schedule_id) ?? [],
        channelId: first.channel_id ?? null,
        learningSpaceId: first.learning_space_id ?? null,
        learningSpaceTitle: first.learning_space_id
          ? (learningSpaceTitles.get(first.learning_space_id) ?? null)
          : null,
        completedAt: confirmedActors.length
          ? confirmedActors
              .map((actor) => actor.completedAt)
              .sort((left, right) => right.localeCompare(left))[0]!
          : (first.resolved_at ?? first.updated_at ?? first.session_end_at),
        completionMethod,
        confirmedBy: confirmedActors,
        guardians,
        participants: [...participants.values()],
        averageRating: ratings.length
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : null,
      };
    });
  }
}
