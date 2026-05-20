import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  SubmitCompletionVoteInput,
  SubmitSessionFeedbackInput,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

type SubmitSessionFeedbackRequest = SubmitSessionFeedbackInput & {
  recipientProfileId?: string | null;
};

type AccountRow = {
  id: string;
  org_id: string;
};

type ProfileRow = {
  id: string;
  account_id: string;
  org_id: string;
  kind?: string | null;
};

type CompletionParticipant = {
  id: string;
  role: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function normalizeComment(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class ActivityFeedService {
  private readonly logger = new Logger(ActivityFeedService.name);

  async submitFeedback(authUserId: string, body: SubmitSessionFeedbackRequest) {
    if (
      !body?.orgId ||
      !body.classSessionId ||
      !body.classroomId ||
      !body.channelId ||
      (!body.sourceEventId && !body.messageId) ||
      !Number.isInteger(body.rating) ||
      body.rating < 1 ||
      body.rating > 5
    ) {
      this.logger.error(
        `rejecting invalid payload authUserId=${authUserId} orgId=${body?.orgId ?? 'none'} rating=${String(body?.rating)}`,
      );
      throw new BadRequestException('Invalid payload');
    }

    if (!isUuid(body.classSessionId)) {
      this.logger.error(`invalid classSessionId: ${body.classSessionId}`);
      throw new BadRequestException('Invalid classSessionId');
    }
    if (!isUuid(body.classroomId)) {
      this.logger.error(`invalid classroomId: ${body.classroomId}`);
      throw new BadRequestException('Invalid classroomId');
    }
    if (!isUuid(body.channelId)) {
      this.logger.error(`invalid channelId: ${body.channelId}`);
      throw new BadRequestException('Invalid channelId');
    }
    if (body.sourceEventId && !isUuid(body.sourceEventId)) {
      this.logger.error(`invalid sourceEventId: ${body.sourceEventId}`);
      throw new BadRequestException('Invalid sourceEventId');
    }
    if (body.messageId && !isUuid(body.messageId)) {
      this.logger.error(`invalid messageId: ${body.messageId}`);
      throw new BadRequestException('Invalid messageId');
    }
    if (body.recipientProfileId && !isUuid(body.recipientProfileId)) {
      this.logger.error(`invalid recipientProfileId: ${body.recipientProfileId}`);
      throw new BadRequestException('Invalid recipientProfileId');
    }

    const comment = normalizeComment(body.comment);
    if (comment && comment.length > 1000) {
      this.logger.error(`comment too long orgId=${body.orgId} length=${comment.length}`);
      throw new BadRequestException('Comment is too long');
    }

    const supabase = createSupabaseServiceClient();

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, org_id')
      .eq('auth_user_id', authUserId)
      .eq('org_id', body.orgId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<AccountRow>();

    if (accountError) {
      this.logger.error(
        `account lookup failed authUserId=${authUserId}: ${accountError.message}`,
      );
      throw new InternalServerErrorException(accountError.message);
    }
    if (!account) {
      this.logger.error(`account not found authUserId=${authUserId} orgId=${body.orgId}`);
      throw new NotFoundException('Account not found');
    }

    const recipientProfileId =
      body.recipientProfileId?.trim() ||
      (await this.resolveActiveProfileId(account.id, body.orgId));
    this.logger.log(
      `resolved recipientProfileId=${recipientProfileId} for accountId=${account.id} orgId=${body.orgId}`,
    );
    const recipientProfile = await this.resolvePermittedProfile(
      account,
      body.orgId,
      recipientProfileId,
    );
    this.logger.log(
      `permitted recipientProfileId=${recipientProfile.id} accountId=${recipientProfile.account_id}`,
    );

    const { data: classroom, error: classroomError } = await supabase
      .from('learning_spaces')
      .select('status, archived_at')
      .eq('org_id', body.orgId)
      .eq('id', body.classroomId)
      .is('deleted_at', null)
      .maybeSingle<{ status: string | null; archived_at: string | null }>();

    if (classroomError) {
      this.logger.error(
        `classroom lookup failed classroomId=${body.classroomId}: ${classroomError.message}`,
      );
      throw new InternalServerErrorException(classroomError.message);
    }

    const archivedAt = classroom?.archived_at ?? null;
    const occurrenceMs = body.occurrenceStartAt
      ? new Date(body.occurrenceStartAt).getTime()
      : Number.POSITIVE_INFINITY;
    const archivedMs = archivedAt ? new Date(archivedAt).getTime() : Number.NaN;
    if (
      (archivedAt || classroom?.status === 'archived') &&
      (!Number.isFinite(occurrenceMs) ||
        !Number.isFinite(archivedMs) ||
        occurrenceMs > archivedMs)
    ) {
      this.logger.error(
        `feedback rejected for archived classroomId=${body.classroomId} occurrenceStartAt=${body.occurrenceStartAt ?? 'none'}`,
      );
      throw new ForbiddenException(
        'Archived classrooms cannot receive feedback for future sessions',
      );
    }

    if (body.sourceEventId) {
      const activityAccessResponse = await supabase
        .from('activity_feed_items')
        .select('id')
        .eq('org_id', body.orgId)
        .eq('recipient_profile_id', recipientProfile.id)
        .eq('source_event_id', body.sourceEventId)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (activityAccessResponse.error) {
        this.logger.error(
          `activity access lookup failed sourceEventId=${body.sourceEventId}: ${activityAccessResponse.error.message}`,
        );
        throw new InternalServerErrorException(activityAccessResponse.error.message);
      }
      if (!activityAccessResponse.data) {
        this.logger.error(
          `activity not found sourceEventId=${body.sourceEventId} recipientProfileId=${recipientProfile.id}`,
        );
        throw new NotFoundException('Activity not found');
      }
    }

    if (body.messageId) {
      const messageResponse = await supabase
        .from('messages')
        .select('channel_id')
        .eq('org_id', body.orgId)
        .eq('id', body.messageId)
        .is('deleted_at', null)
        .maybeSingle<{ channel_id: string }>();

      if (messageResponse.error) {
        this.logger.error(
          `message lookup failed messageId=${body.messageId}: ${messageResponse.error.message}`,
        );
        throw new InternalServerErrorException(messageResponse.error.message);
      }
      if (!messageResponse.data) {
        this.logger.error(`message not found messageId=${body.messageId}`);
        throw new NotFoundException('Message not found');
      }

      const memberResponse = await supabase
        .from('channel_members')
        .select('id')
        .eq('org_id', body.orgId)
        .eq('channel_id', messageResponse.data.channel_id)
        .eq('profile_id', recipientProfile.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>();

      if (memberResponse.error) {
        this.logger.error(
          `channel member lookup failed messageId=${body.messageId} recipientProfileId=${recipientProfile.id}: ${memberResponse.error.message}`,
        );
        throw new InternalServerErrorException(memberResponse.error.message);
      }
      if (!memberResponse.data) {
        this.logger.error(
          `recipientProfileId=${recipientProfile.id} is not a channel member for messageId=${body.messageId}`,
        );
        throw new ForbiddenException('Forbidden');
      }
    }

    const now = new Date().toISOString();
    const upsertResponse = await supabase
      .from('class_session_feedback')
      .upsert(
        {
          org_id: body.orgId,
          recipient_profile_id: recipientProfile.id,
          class_session_id: body.classSessionId,
          classroom_id: body.classroomId,
          channel_id: body.channelId,
          source_event_id: body.sourceEventId ?? null,
          message_id: body.messageId ?? null,
          occurrence_start_at: body.occurrenceStartAt ?? null,
          rating: body.rating,
          comment,
          submitted_at: now,
          updated_at: now,
          updated_by: recipientProfile.id,
          deleted_at: null,
          deleted_by: null,
        },
        { onConflict: 'org_id,recipient_profile_id,class_session_id' },
      )
      .select(
        'source_event_id, message_id, class_session_id, classroom_id, channel_id, occurrence_start_at, rating, comment, submitted_at',
      )
      .single<{
        source_event_id: string | null;
        message_id: string | null;
        class_session_id: string;
        classroom_id: string;
        channel_id: string;
        occurrence_start_at: string | null;
        rating: number;
        comment: string | null;
        submitted_at: string;
      }>();

    if (upsertResponse.error) {
      this.logger.error(
        `feedback upsert failed classSessionId=${body.classSessionId} recipientProfileId=${recipientProfile.id}: ${upsertResponse.error.message}`,
      );
      throw new InternalServerErrorException(upsertResponse.error.message);
    }

    this.logger.log(
      `feedback saved classSessionId=${body.classSessionId} recipientProfileId=${recipientProfile.id} rating=${body.rating}`,
    );

    return {
      success: true,
      data: {
        sourceEventId: upsertResponse.data.source_event_id,
        messageId: upsertResponse.data.message_id,
        classSessionId: upsertResponse.data.class_session_id,
        classroomId: upsertResponse.data.classroom_id,
        channelId: upsertResponse.data.channel_id,
        occurrenceStartAt: upsertResponse.data.occurrence_start_at,
        rating: upsertResponse.data.rating,
        comment: upsertResponse.data.comment,
        submittedAt: upsertResponse.data.submitted_at,
      },
    };
  }

  async submitCompletionVote(authUserId: string, body: SubmitCompletionVoteInput) {
    const VALID_STATUSES = ['confirmed', 'disputed'] as const;
    const VALID_CATEGORIES = [
      'teacher_absent',
      'student_absent',
      'technical_issue',
      'other',
    ] as const;

    if (!body?.orgId || !body.scheduleId || !body.occurrenceKey || !body.role) {
      throw new BadRequestException('Missing required fields');
    }
    if (!isUuid(body.orgId)) throw new BadRequestException('Invalid orgId');
    if (!isUuid(body.scheduleId)) throw new BadRequestException('Invalid scheduleId');
    if (!VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
      throw new BadRequestException('Invalid status');
    }
    if (
      body.status === 'disputed' &&
      !VALID_CATEGORIES.includes(
        body.disputeCategory as (typeof VALID_CATEGORIES)[number],
      )
    ) {
      throw new BadRequestException('disputeCategory required when status is disputed');
    }

    const disputeReason = body.disputeReason?.trim() ?? null;
    if (disputeReason && disputeReason.length > 500) {
      throw new BadRequestException('disputeReason is too long');
    }

    const supabase = createSupabaseServiceClient();

    // Resolve caller account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, org_id')
      .eq('auth_user_id', authUserId)
      .eq('org_id', body.orgId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<AccountRow>();

    if (accountError) throw new InternalServerErrorException(accountError.message);
    if (!account) throw new NotFoundException('Account not found');

    const profileId = await this.resolveActiveProfileId(account.id, body.orgId);

    const participant = await this.resolveCompletionVoteParticipant({
      supabase,
      orgId: body.orgId,
      scheduleId: body.scheduleId,
      profileId,
      accountId: account.id,
    });

    if (!participant) throw new ForbiddenException('Not a participant of this session');

    const now = new Date().toISOString();

    // Upsert vote
    const { error: voteError } = await supabase
      .from('class_session_completion_votes')
      .upsert(
        {
          org_id: body.orgId,
          schedule_id: body.scheduleId,
          occurrence_key: body.occurrenceKey,
          profile_id: profileId,
          role: participant.role,
          status: body.status,
          dispute_category:
            body.status === 'disputed' ? (body.disputeCategory ?? null) : null,
          dispute_reason: body.status === 'disputed' ? (disputeReason ?? null) : null,
          reschedule_requested:
            body.status === 'disputed' ? (body.rescheduleRequested ?? false) : false,
          voted_at: now,
          updated_at: now,
          updated_by: profileId,
          deleted_at: null,
        },
        { onConflict: 'org_id,schedule_id,occurrence_key,profile_id' },
      );

    if (voteError) throw new InternalServerErrorException(voteError.message);

    this.logger.log(
      `completion vote saved scheduleId=${body.scheduleId} profileId=${profileId} status=${body.status}`,
    );

    if (body.status === 'confirmed') {
      return { feedbackEnabled: true };
    }

    // Disputed: fan out to staff
    await this.publishDisputeNotifications({
      supabase,
      orgId: body.orgId,
      scheduleId: body.scheduleId,
      occurrenceKey: body.occurrenceKey,
      reportedByProfileId: profileId,
      reportedByRole: participant.role,
      disputeCategory: body.disputeCategory ?? 'other',
      disputeReason: disputeReason ?? null,
      rescheduleRequested: body.rescheduleRequested ?? false,
    });

    return { feedbackEnabled: false };
  }

  private async publishDisputeNotifications(input: {
    supabase: ReturnType<typeof createSupabaseServiceClient>;
    orgId: string;
    scheduleId: string;
    occurrenceKey: string;
    reportedByProfileId: string;
    reportedByRole: string;
    disputeCategory: string;
    disputeReason: string | null;
    rescheduleRequested: boolean;
  }) {
    const {
      supabase,
      orgId,
      scheduleId,
      occurrenceKey,
      reportedByProfileId,
      reportedByRole,
      disputeCategory,
      disputeReason,
      rescheduleRequested,
    } = input;

    // Load session details + participants
    const { data: session } = await supabase
      .from('class_schedules')
      .select(
        `id, title, source_channel_id, source_learning_space_id,
         participants:class_schedule_participants(profile_id, role, display_name)`,
      )
      .eq('id', scheduleId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        title: string;
        source_channel_id: string | null;
        source_learning_space_id: string | null;
        participants: Array<{
          profile_id: string;
          role: string;
          display_name: string | null;
        }>;
      }>();

    if (!session) {
      this.logger.warn(
        `publishDisputeNotifications: session not found scheduleId=${scheduleId}`,
      );
      return;
    }

    // Load the reporter's display name
    const { data: reporterProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', reportedByProfileId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ display_name: string | null }>();

    const reportedByDisplayName = reporterProfile?.display_name ?? 'Unknown';

    const channelId = session.source_channel_id ?? '';
    const learningSpaceId = session.source_learning_space_id ?? null;

    const basePayload = {
      channelId,
      learningSpaceId,
      scheduleId,
      occurrenceStart: occurrenceKey,
      title: session.title,
      reportedByProfileId,
      reportedByDisplayName,
      reportedByRole,
      disputeCategory,
      disputeReason,
      rescheduleRequested,
    };

    const scope = learningSpaceId
      ? { kind: 'learning_space' as const, learningSpaceId }
      : { kind: 'channel' as const, channelId };

    // All active staff in this org
    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .eq('kind', 'staff')
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    const staffIds = (staffProfiles ?? []).map((p) => p.id);

    if (staffIds.length > 0) {
      // Load educator display names to enrich the staff headline
      const educatorNames = session.participants
        .filter((p) => p.role === 'educator')
        .map((p) => p.display_name ?? 'Unknown')
        .join(', ');

      await publishActivityEvent({
        supabase,
        orgId,
        eventType: 'session.completion.dispute_reported',
        sourceKind: 'system',
        scope,
        objectRef: { kind: 'session', id: scheduleId },
        audienceRules: [{ kind: 'users_only', userIds: staffIds }],
        payload: {
          ...basePayload,
          recipientRole: 'staff',
          educatorNames,
        },
        dedupeKey: `dispute:${scheduleId}:${occurrenceKey}:staff:${reportedByProfileId}`,
        refreshOnDedupe: true,
      });
    }
  }

  private async resolveCompletionVoteParticipant(input: {
    supabase: ReturnType<typeof createSupabaseServiceClient>;
    orgId: string;
    scheduleId: string;
    profileId: string;
    accountId: string;
  }): Promise<CompletionParticipant | null> {
    const { data: directParticipant, error: participantError } = await input.supabase
      .from('class_schedule_participants')
      .select('id, role')
      .eq('org_id', input.orgId)
      .eq('schedule_id', input.scheduleId)
      .eq('profile_id', input.profileId)
      .is('deleted_at', null)
      .maybeSingle<CompletionParticipant>();

    if (participantError) {
      throw new InternalServerErrorException(participantError.message);
    }
    if (directParticipant) {
      return directParticipant;
    }

    const { data: profile, error: profileError } = await input.supabase
      .from('profiles')
      .select('id, account_id, org_id, kind')
      .eq('org_id', input.orgId)
      .eq('id', input.profileId)
      .is('deleted_at', null)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }
    if (profile?.kind !== 'guardian') {
      return null;
    }

    const { data: familyLinks, error: familyLinksError } = await input.supabase
      .from('family_links')
      .select('child_account_id')
      .eq('org_id', input.orgId)
      .eq('guardian_account_id', input.accountId)
      .is('deleted_at', null)
      .returns<Array<{ child_account_id: string }>>();

    if (familyLinksError) {
      throw new InternalServerErrorException(familyLinksError.message);
    }

    const childAccountIds = Array.from(
      new Set((familyLinks ?? []).map((link) => link.child_account_id).filter(Boolean)),
    );
    if (!childAccountIds.length) {
      return null;
    }

    const { data: childProfiles, error: childProfilesError } = await input.supabase
      .from('profiles')
      .select('id')
      .eq('org_id', input.orgId)
      .in('account_id', childAccountIds)
      .eq('kind', 'child')
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    if (childProfilesError) {
      throw new InternalServerErrorException(childProfilesError.message);
    }

    const childProfileIds = Array.from(
      new Set(
        (childProfiles ?? []).map((childProfile) => childProfile.id).filter(Boolean),
      ),
    );
    if (!childProfileIds.length) {
      return null;
    }

    const { data: childParticipant, error: childParticipantError } = await input.supabase
      .from('class_schedule_participants')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('schedule_id', input.scheduleId)
      .in('profile_id', childProfileIds)
      .eq('role', 'child')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (childParticipantError) {
      throw new InternalServerErrorException(childParticipantError.message);
    }

    return childParticipant ? { id: childParticipant.id, role: 'guardian' } : null;
  }

  private async resolveActiveProfileId(accountId: string, orgId: string) {
    const supabase = createSupabaseServiceClient();
    const { data: account, error } = await supabase
      .from('accounts')
      .select('active_profile_id')
      .eq('id', accountId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ active_profile_id: string | null }>();

    if (error) {
      this.logger.error(
        `active profile lookup failed accountId=${accountId} orgId=${orgId}: ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
    if (!account?.active_profile_id) {
      this.logger.error(`no active profile accountId=${accountId} orgId=${orgId}`);
      throw new ForbiddenException('No active profile');
    }

    return account.active_profile_id;
  }

  private async resolvePermittedProfile(
    account: AccountRow,
    orgId: string,
    recipientProfileId: string,
  ) {
    const supabase = createSupabaseServiceClient();
    const { data: requestedProfile, error: requestedProfileError } = await supabase
      .from('profiles')
      .select('id, account_id, org_id')
      .eq('id', recipientProfileId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<ProfileRow>();

    if (requestedProfileError) {
      this.logger.error(
        `requested profile lookup failed profileId=${recipientProfileId} orgId=${orgId}: ${requestedProfileError.message}`,
      );
      throw new InternalServerErrorException(requestedProfileError.message);
    }
    if (!requestedProfile) {
      this.logger.error(
        `requested profile not found profileId=${recipientProfileId} orgId=${orgId}`,
      );
      throw new NotFoundException('Profile not found');
    }

    if (requestedProfile.account_id === account.id) {
      return requestedProfile;
    }

    const { data: familyLink, error: familyLinkError } = await supabase
      .from('family_links')
      .select('child_account_id')
      .eq('org_id', orgId)
      .eq('guardian_account_id', account.id)
      .eq('child_account_id', requestedProfile.account_id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ child_account_id: string }>();

    if (familyLinkError) {
      this.logger.error(
        `family link lookup failed guardianAccountId=${account.id} childAccountId=${requestedProfile.account_id}: ${familyLinkError.message}`,
      );
      throw new InternalServerErrorException(familyLinkError.message);
    }
    if (!familyLink) {
      this.logger.error(
        `forbidden recipient profile profileId=${requestedProfile.id} accountId=${requestedProfile.account_id} requesterAccountId=${account.id}`,
      );
      throw new ForbiddenException('Forbidden');
    }

    return requestedProfile;
  }
}
