-- Do not enqueue session_cancel or session_reschedule activity events for
-- occurrences whose original start time (occurrence_key) is already in the past.
-- Past-session cancels/reschedules need reminder reconciliation but not
-- activity feed entries or push notifications.

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

  if new.occurrence_key < timezone('utc', now()) then
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

  if new.occurrence_key < timezone('utc', now()) then
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
