import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { SubmitSessionFeedbackInput } from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

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
