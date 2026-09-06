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
  ClassSessionCompletionRow,
  ConfirmSessionCompletionInput,
  ConnectionVM,
  DisputeSessionCompletionInput,
  RateSessionCompletionInput,
  SessionCompletionVM,
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

  async confirm(authUserId: string, body: ConfirmSessionCompletionInput) {
    const row = await this.loadOwnedRow(authUserId, body.orgId, body.sessionCompletionId);
    if (row.status !== 'pending') {
      throw new BadRequestException(
        `Cannot confirm a session completion in status '${row.status}'`,
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
      throw new BadRequestException(
        `Cannot dispute a session completion in status '${row.status}'`,
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
      throw new ConflictException('Session completion was already resolved');
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
}
