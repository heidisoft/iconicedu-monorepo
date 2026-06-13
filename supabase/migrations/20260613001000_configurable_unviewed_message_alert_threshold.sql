create or replace function public.message_unviewed_check_threshold_hours()
returns integer
language sql
stable
set search_path = public
as $$
  with raw_setting as (
    select nullif(current_setting('app.message_unviewed_check_threshold_hours', true), '') as value
  )
  select case
    when value ~ '^[0-9]+(\.[0-9]+)?$' and value::numeric > 0 then
      least(168, greatest(1, ceiling(value::numeric)::integer))
    else 4
  end
  from raw_setting;
$$;

comment on function public.message_unviewed_check_threshold_hours() is
  'Returns the classroom unviewed-message staff alert threshold in hours. Configure with ALTER DATABASE ... SET app.message_unviewed_check_threshold_hours = ''4''.';

create or replace function public.enqueue_message_event_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_is_learning_space_channel boolean := false;
  v_unviewed_threshold_hours integer := public.message_unviewed_check_threshold_hours();
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
      v_now,
      new.created_by,
      new.updated_by
    );

    select exists (
      select 1
      from public.channels c
      where c.id = new.channel_id
        and c.org_id = new.org_id
        and c.primary_entity_kind = 'learning_space'
        and c.primary_entity_id is not null
        and c.deleted_at is null
    )
    into v_is_learning_space_channel;

    if v_is_learning_space_channel and new.thread_parent_id is null then
      perform public.enqueue_event_pipeline_job(
        new.org_id,
        'activity.generate',
        'message_unviewed_check:' || new.id::text,
        jsonb_build_object(
          'sourceKind', 'message_unviewed_check',
          'messageId', new.id,
          'thresholdHours', v_unviewed_threshold_hours
        ),
        null,
        'message_unviewed_check',
        new.id,
        v_now + make_interval(hours => v_unviewed_threshold_hours),
        70,
        new.created_by,
        new.updated_by
      );
    end if;
  end if;

  return new;
end;
$$;
