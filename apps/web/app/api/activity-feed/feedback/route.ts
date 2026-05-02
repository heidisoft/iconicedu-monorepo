import { NextResponse } from 'next/server';

import type { SubmitSessionFeedbackInput } from '@iconicedu/shared-types';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';

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

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase);
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    throw error;
  }
  if (!actor) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const body = (await request
    .json()
    .catch(() => null)) as SubmitSessionFeedbackInput | null;
  if (
    !body ||
    !body.orgId ||
    !body.classSessionId ||
    !body.classroomId ||
    !body.channelId ||
    (!body.sourceEventId && !body.messageId) ||
    !Number.isInteger(body.rating) ||
    body.rating < 1 ||
    body.rating > 5
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (body.orgId !== actor.account.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isUuid(body.classSessionId)) {
    return NextResponse.json({ error: 'Invalid classSessionId' }, { status: 400 });
  }
  if (!isUuid(body.classroomId)) {
    return NextResponse.json({ error: 'Invalid classroomId' }, { status: 400 });
  }
  if (!isUuid(body.channelId)) {
    return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
  }
  if (body.sourceEventId && !isUuid(body.sourceEventId)) {
    return NextResponse.json({ error: 'Invalid sourceEventId' }, { status: 400 });
  }
  if (body.messageId && !isUuid(body.messageId)) {
    return NextResponse.json({ error: 'Invalid messageId' }, { status: 400 });
  }

  const comment = normalizeComment(body.comment);
  if (comment && comment.length > 1000) {
    return NextResponse.json({ error: 'Comment is too long' }, { status: 400 });
  }

  const classroomResponse = await supabase
    .from('learning_spaces')
    .select('status, archived_at')
    .eq('org_id', actor.account.org_id)
    .eq('id', body.classroomId)
    .is('deleted_at', null)
    .maybeSingle<{ status: string | null; archived_at: string | null }>();

  if (classroomResponse.error) {
    return NextResponse.json({ error: classroomResponse.error.message }, { status: 500 });
  }

  const archivedAt = classroomResponse.data?.archived_at ?? null;
  const occurrenceMs = body.occurrenceStartAt
    ? new Date(body.occurrenceStartAt).getTime()
    : Number.POSITIVE_INFINITY;
  const archivedMs = archivedAt ? new Date(archivedAt).getTime() : Number.NaN;
  if (
    (archivedAt || classroomResponse.data?.status === 'archived') &&
    (!Number.isFinite(occurrenceMs) ||
      !Number.isFinite(archivedMs) ||
      occurrenceMs > archivedMs)
  ) {
    return NextResponse.json(
      { error: 'Archived classrooms cannot receive feedback for future sessions' },
      { status: 403 },
    );
  }

  if (body.sourceEventId) {
    const activityAccessResponse = await supabase
      .from('activity_feed_items')
      .select('id')
      .eq('org_id', actor.account.org_id)
      .eq('recipient_profile_id', actor.profile.id)
      .eq('source_event_id', body.sourceEventId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (activityAccessResponse.error) {
      return NextResponse.json(
        { error: activityAccessResponse.error.message },
        { status: 500 },
      );
    }
    if (!activityAccessResponse.data) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }
  }

  if (body.messageId) {
    const messageResponse = await supabase
      .from('messages')
      .select('channel_id')
      .eq('org_id', actor.account.org_id)
      .eq('id', body.messageId)
      .is('deleted_at', null)
      .maybeSingle<{ channel_id: string }>();

    if (messageResponse.error) {
      return NextResponse.json({ error: messageResponse.error.message }, { status: 500 });
    }
    if (!messageResponse.data) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const memberResponse = await supabase
      .from('channel_members')
      .select('id')
      .eq('org_id', actor.account.org_id)
      .eq('channel_id', messageResponse.data.channel_id)
      .eq('profile_id', actor.profile.id)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (memberResponse.error) {
      return NextResponse.json({ error: memberResponse.error.message }, { status: 500 });
    }
    if (!memberResponse.data) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const now = new Date().toISOString();
  const upsertResponse = await supabase
    .from('class_session_feedback')
    .upsert(
      {
        org_id: actor.account.org_id,
        recipient_profile_id: actor.profile.id,
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
        updated_by: actor.profile.id,
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
    return NextResponse.json({ error: upsertResponse.error.message }, { status: 500 });
  }

  return NextResponse.json({
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
  });
}
