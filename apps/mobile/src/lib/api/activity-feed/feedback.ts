import type { SubmitSessionFeedbackInput } from '@iconicedu/shared-types';
import { supabase } from '@/lib/supabase/client';

type SubmitSessionFeedbackRequest = SubmitSessionFeedbackInput & {
  recipientProfileId?: string | null;
};

type SubmitSessionFeedbackResponse = {
  sourceEventId?: string | null;
  messageId?: string | null;
  classSessionId?: string;
  classroomId?: string;
  channelId?: string;
  occurrenceStartAt?: string | null;
  rating?: number;
  comment?: string | null;
  submittedAt?: string | null;
};

function normalizeComment(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveScheduleIdForFeedback(input: {
  orgId: string;
  classSessionId: string;
  classroomId: string;
  channelId: string;
}) {
  const { data: scheduleRow, error: scheduleError } = await supabase
    .from('class_schedules')
    .select('id, source_session_id')
    .eq('org_id', input.orgId)
    .eq('source_learning_space_id', input.classroomId)
    .eq('source_channel_id', input.channelId)
    .is('deleted_at', null)
    .or(`id.eq.${input.classSessionId},source_session_id.eq.${input.classSessionId}`)
    .limit(1)
    .maybeSingle<{ id: string; source_session_id: string | null }>();

  if (scheduleError) {
    throw new Error(scheduleError.message);
  }

  return scheduleRow?.id ?? input.classSessionId;
}

export async function submitActivityFeedFeedback(
  input: SubmitSessionFeedbackRequest,
): Promise<SubmitSessionFeedbackResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const recipientProfileId = input.recipientProfileId?.trim();
  if (!recipientProfileId) {
    throw new Error('Missing recipient profile');
  }

  const payload = {
    orgId: input.orgId,
    recipientProfileId,
    classSessionId: input.classSessionId,
    classroomId: input.classroomId,
    channelId: input.channelId,
    sourceEventId: input.sourceEventId ?? null,
    messageId: input.messageId ?? null,
    occurrenceStartAt: input.occurrenceStartAt ?? null,
    rating: input.rating,
    comment: normalizeComment(input.comment),
  };

  if (payload.sourceEventId) {
    const { data: activityItem, error: activityError } = await supabase
      .from('activity_feed_items')
      .select('id')
      .eq('org_id', payload.orgId)
      .eq('recipient_profile_id', payload.recipientProfileId)
      .eq('source_event_id', payload.sourceEventId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (activityError) {
      throw new Error(activityError.message);
    }
    if (!activityItem) {
      throw new Error('Activity not found');
    }
  }

  if (payload.messageId) {
    const { data: messageRow, error: messageError } = await supabase
      .from('messages')
      .select('channel_id')
      .eq('org_id', payload.orgId)
      .eq('id', payload.messageId)
      .is('deleted_at', null)
      .maybeSingle<{ channel_id: string }>();

    if (messageError) {
      throw new Error(messageError.message);
    }
    if (!messageRow) {
      throw new Error('Message not found');
    }

    const { data: membershipRow, error: membershipError } = await supabase
      .from('channel_members')
      .select('id')
      .eq('org_id', payload.orgId)
      .eq('channel_id', messageRow.channel_id)
      .eq('profile_id', payload.recipientProfileId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (membershipError) {
      throw new Error(membershipError.message);
    }
    if (!membershipRow) {
      throw new Error('Forbidden');
    }
  }

  const resolvedClassSessionId = await resolveScheduleIdForFeedback({
    orgId: payload.orgId,
    classSessionId: payload.classSessionId,
    classroomId: payload.classroomId,
    channelId: payload.channelId,
  });

  const now = new Date().toISOString();
  const upsertBody = {
    org_id: payload.orgId,
    recipient_profile_id: payload.recipientProfileId,
    class_session_id: resolvedClassSessionId,
    classroom_id: payload.classroomId,
    channel_id: payload.channelId,
    source_event_id: payload.sourceEventId,
    message_id: payload.messageId,
    occurrence_start_at: payload.occurrenceStartAt,
    rating: payload.rating,
    comment: payload.comment,
    submitted_at: now,
    updated_at: now,
    updated_by: payload.recipientProfileId,
    deleted_at: null,
    deleted_by: null,
  };

  const { data: feedbackRow, error: upsertError } = await supabase
    .from('class_session_feedback')
    .upsert(upsertBody, {
      onConflict: 'org_id,recipient_profile_id,class_session_id',
    })
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

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return {
    sourceEventId: feedbackRow.source_event_id,
    messageId: feedbackRow.message_id,
    classSessionId: feedbackRow.class_session_id,
    classroomId: feedbackRow.classroom_id,
    channelId: feedbackRow.channel_id,
    occurrenceStartAt: feedbackRow.occurrence_start_at,
    rating: feedbackRow.rating,
    comment: feedbackRow.comment,
    submittedAt: feedbackRow.submitted_at,
  };
}
