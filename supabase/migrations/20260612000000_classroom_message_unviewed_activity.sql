create or replace function public.enqueue_message_event_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_is_learning_space_channel boolean := false;
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
          'thresholdHours', 24
        ),
        null,
        'message_unviewed_check',
        new.id,
        v_now + interval '24 hours',
        70,
        new.created_by,
        new.updated_by
      );
    end if;
  end if;

  return new;
end;
$$;
