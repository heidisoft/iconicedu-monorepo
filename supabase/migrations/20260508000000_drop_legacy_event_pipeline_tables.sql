-- Legacy queue tables were kept only for the unified pipeline migration/backfill.
-- The live pipeline now uses event_outbox, event_pipeline_jobs, and event_pipeline_logs.

insert into public.event_outbox (
  org_id,
  event_kind,
  source_table,
  source_id,
  source_kind,
  payload,
  dedupe_key,
  status,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  j.org_id,
  j.job_kind,
  case
    when j.job_kind = 'message' then 'messages'
    when j.job_kind = 'reaction' then 'message_reactions'
    when j.job_kind = 'session_cancel' then 'class_schedule_recurrence_exceptions'
    when j.job_kind = 'session_reschedule' then 'class_schedule_recurrence_overrides'
    else null
  end,
  coalesce(j.message_id, j.reaction_id, j.exception_id, j.override_id),
  j.job_kind,
  jsonb_strip_nulls(jsonb_build_object(
    'messageId', j.message_id,
    'reactionId', j.reaction_id,
    'exceptionId', j.exception_id,
    'overrideId', j.override_id
  )),
  j.dedupe_key,
  'pending',
  j.created_by,
  j.updated_by,
  j.created_at,
  timezone('utc', now())
from public.activity_source_jobs j
where j.deleted_at is null
  and j.status in ('pending', 'failed', 'leased')
on conflict (org_id, dedupe_key) do nothing;

insert into public.event_pipeline_jobs (
  org_id,
  outbox_id,
  job_kind,
  source_kind,
  source_id,
  dedupe_key,
  payload,
  priority,
  status,
  attempt_count,
  max_attempts,
  run_at,
  next_attempt_at,
  last_error,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  j.org_id,
  o.id,
  'activity.generate',
  j.job_kind,
  coalesce(j.message_id, j.reaction_id, j.exception_id, j.override_id),
  j.dedupe_key,
  jsonb_build_object(
    'eventKind', j.job_kind,
    'sourceTable',
      case
        when j.job_kind = 'message' then 'messages'
        when j.job_kind = 'reaction' then 'message_reactions'
        when j.job_kind = 'session_cancel' then 'class_schedule_recurrence_exceptions'
        when j.job_kind = 'session_reschedule' then 'class_schedule_recurrence_overrides'
        else null
      end,
    'sourceId', coalesce(j.message_id, j.reaction_id, j.exception_id, j.override_id),
    'sourceKind', j.job_kind,
    'payload', jsonb_strip_nulls(jsonb_build_object(
      'messageId', j.message_id,
      'reactionId', j.reaction_id,
      'exceptionId', j.exception_id,
      'overrideId', j.override_id
    ))
  ),
  50,
  case when j.status = 'failed' then 'failed' else 'pending' end,
  j.attempt_count,
  j.max_attempts,
  j.run_at,
  j.next_attempt_at,
  j.last_error,
  j.created_by,
  j.updated_by,
  j.created_at,
  timezone('utc', now())
from public.activity_source_jobs j
join public.event_outbox o
  on o.org_id = j.org_id
 and o.dedupe_key = j.dedupe_key
where j.deleted_at is null
  and j.status in ('pending', 'failed', 'leased')
on conflict (org_id, job_kind, dedupe_key) where deleted_at is null and status in ('pending', 'leased', 'failed')
do nothing;

insert into public.event_pipeline_jobs (
  org_id,
  job_kind,
  source_kind,
  source_id,
  dedupe_key,
  payload,
  priority,
  status,
  attempt_count,
  max_attempts,
  run_at,
  next_attempt_at,
  last_error,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  j.org_id,
  'notification.deliver',
  'activity_event',
  j.activity_event_id,
  'notification.deliver:' || j.activity_event_id::text || ':' || j.recipient_profile_id::text || ':' || j.delivery_channel || ':' || j.attempt_bucket,
  jsonb_build_object(
    'activityEventId', j.activity_event_id,
    'recipientProfileId', j.recipient_profile_id,
    'prefKey', j.pref_key,
    'scopeKind', j.scope_kind,
    'scopeId', j.scope_id,
    'deliveryChannel', j.delivery_channel,
    'deliveryTiming', j.delivery_timing,
    'attemptBucket', j.attempt_bucket,
    'title', j.payload->>'title',
    'summary', j.payload->>'summary',
    'threadId', j.payload->>'threadId',
    'rawEventPayload', coalesce(j.payload->'rawEventPayload', '{}'::jsonb)
  ),
  case when j.delivery_timing = 'immediate' then 80 else 100 end,
  case when j.status = 'failed' then 'failed' else 'pending' end,
  j.attempt_count,
  j.max_attempts,
  j.run_at,
  j.next_attempt_at,
  j.last_error,
  j.created_by,
  j.updated_by,
  j.created_at,
  timezone('utc', now())
from public.notification_dispatch_jobs j
where j.deleted_at is null
  and j.status in ('pending', 'failed', 'leased')
on conflict (org_id, job_kind, dedupe_key) where deleted_at is null and status in ('pending', 'leased', 'failed')
do nothing;

insert into public.event_pipeline_jobs (
  org_id,
  job_kind,
  source_kind,
  source_id,
  dedupe_key,
  payload,
  priority,
  status,
  attempt_count,
  max_attempts,
  run_at,
  next_attempt_at,
  last_error,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  j.org_id,
  'reminder.reconcile',
  'schedule',
  j.schedule_id,
  j.dedupe_key,
  jsonb_build_object('scheduleId', j.schedule_id),
  40,
  case when j.status = 'failed' then 'failed' else 'pending' end,
  j.attempt_count,
  j.max_attempts,
  j.run_at,
  j.next_attempt_at,
  j.last_error,
  j.created_by,
  j.updated_by,
  j.created_at,
  timezone('utc', now())
from public.reminder_reconcile_jobs j
where j.deleted_at is null
  and j.status in ('pending', 'failed', 'leased')
on conflict (org_id, job_kind, dedupe_key) where deleted_at is null and status in ('pending', 'leased', 'failed')
do nothing;

create or replace function public.enqueue_message_event_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if new.type not in (
    'event-reminder',
    'payment-reminder',
    'feedback-request',
    'session-booking',
    'session-complete',
    'session-summary',
    'progress-update'
  ) then
    perform public.enqueue_event_outbox(
      new.org_id,
      'message',
      'message:' || new.id::text,
      jsonb_build_object('messageId', new.id),
      'messages',
      new.id,
      'message',
      new.sender_profile_id,
      timezone('utc', now()),
      new.created_by,
      new.updated_by
    );
  end if;

  return new;
end;
$$;

create or replace function public.enqueue_reaction_event_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  perform public.enqueue_event_outbox(
    new.org_id,
    'reaction',
    'reaction:' || new.id::text,
    jsonb_build_object('reactionId', new.id),
    'message_reactions',
    new.id,
    'reaction',
    null,
    timezone('utc', now()),
    new.created_by,
    new.updated_by
  );

  return new;
end;
$$;

create or replace function public.enqueue_session_cancel_event_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  perform public.enqueue_event_outbox(
    new.org_id,
    'session_cancel',
    'session_cancel:' || new.id::text,
    jsonb_build_object('exceptionId', new.id),
    'class_schedule_recurrence_exceptions',
    new.id,
    'session_cancel',
    null,
    timezone('utc', now()),
    new.created_by,
    new.updated_by
  );

  return new;
end;
$$;

create or replace function public.enqueue_session_reschedule_event_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  perform public.enqueue_event_outbox(
    new.org_id,
    'session_reschedule',
    'session_reschedule:' || new.id::text,
    jsonb_build_object('overrideId', new.id),
    'class_schedule_recurrence_overrides',
    new.id,
    'session_reschedule',
    null,
    timezone('utc', now()),
    new.created_by,
    new.updated_by
  );

  return new;
end;
$$;

drop trigger if exists messages_activity_source_job_enqueue on public.messages;
drop trigger if exists messages_event_outbox_enqueue on public.messages;
create trigger messages_event_outbox_enqueue
  after insert on public.messages
  for each row
  execute function public.enqueue_message_event_outbox();

drop trigger if exists message_reactions_activity_source_job_enqueue on public.message_reactions;
drop trigger if exists message_reactions_event_outbox_enqueue on public.message_reactions;
create trigger message_reactions_event_outbox_enqueue
  after insert on public.message_reactions
  for each row
  execute function public.enqueue_reaction_event_outbox();

drop trigger if exists session_exception_activity_source_job_enqueue on public.class_schedule_recurrence_exceptions;
drop trigger if exists session_exception_event_outbox_enqueue on public.class_schedule_recurrence_exceptions;
create trigger session_exception_event_outbox_enqueue
  after insert on public.class_schedule_recurrence_exceptions
  for each row
  execute function public.enqueue_session_cancel_event_outbox();

drop trigger if exists session_override_activity_source_job_enqueue on public.class_schedule_recurrence_overrides;
drop trigger if exists session_override_event_outbox_enqueue on public.class_schedule_recurrence_overrides;
create trigger session_override_event_outbox_enqueue
  after insert on public.class_schedule_recurrence_overrides
  for each row
  execute function public.enqueue_session_reschedule_event_outbox();

create or replace function public.enqueue_reminder_reconcile_job(
  p_org_id uuid,
  p_schedule_id uuid,
  p_created_by uuid default null,
  p_updated_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if p_org_id is null or p_schedule_id is null then
    return;
  end if;

  perform public.enqueue_event_pipeline_job(
    p_org_id,
    'reminder.reconcile',
    'schedule:' || p_schedule_id::text,
    jsonb_build_object('scheduleId', p_schedule_id),
    null,
    'schedule',
    p_schedule_id,
    v_now,
    40,
    p_created_by,
    p_updated_by
  );
end;
$$;

drop function if exists public.claim_due_activity_source_jobs(integer, text, integer);
drop function if exists public.claim_due_notification_dispatch_jobs(integer, text, integer);
drop function if exists public.claim_due_reminder_reconcile_jobs(integer, text, integer);
drop function if exists public.enqueue_message_activity_source_job();
drop function if exists public.enqueue_reaction_activity_source_job();
drop function if exists public.enqueue_session_cancel_activity_source_job();
drop function if exists public.enqueue_session_reschedule_activity_source_job();

drop table if exists public.notification_dispatch_logs cascade;
drop table if exists public.notification_dispatch_jobs cascade;
drop table if exists public.activity_source_jobs cascade;
drop table if exists public.reminder_reconcile_jobs cascade;
