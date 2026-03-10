create table if not exists public.message_session_feedback (
  id uuid primary key default uuid_generate_v7(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  class_session_id uuid not null references public.class_schedules(id) on delete cascade,
  classroom_id uuid not null references public.learning_spaces(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  message_id uuid null references public.messages(id) on delete set null,
  source_event_id uuid null references public.activity_events(id) on delete set null,
  occurrence_start_at timestamptz null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  unique (org_id, recipient_profile_id, class_session_id)
);

create index if not exists message_session_feedback_org_profile_submitted_idx
  on public.message_session_feedback (org_id, recipient_profile_id, submitted_at desc)
  where deleted_at is null;

create index if not exists message_session_feedback_org_session_idx
  on public.message_session_feedback (org_id, class_session_id)
  where deleted_at is null;

create index if not exists message_session_feedback_org_message_idx
  on public.message_session_feedback (org_id, message_id)
  where deleted_at is null and message_id is not null;

create index if not exists message_session_feedback_org_event_idx
  on public.message_session_feedback (org_id, source_event_id)
  where deleted_at is null;

alter table public.message_session_feedback enable row level security;

drop policy if exists "message session feedback self" on public.message_session_feedback;

create policy "message session feedback self"
  on public.message_session_feedback
  for all
  using (
    deleted_at is null
    and public.is_profile_owner(recipient_profile_id)
  )
  with check (
    deleted_at is null
    and public.is_profile_owner(recipient_profile_id)
  );

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'activity_feedback_responses'
  ) then
    insert into public.message_session_feedback (
      org_id,
      recipient_profile_id,
      class_session_id,
      classroom_id,
      channel_id,
      message_id,
      source_event_id,
      occurrence_start_at,
      rating,
      comment,
      submitted_at,
      created_at,
      created_by,
      updated_at,
      updated_by,
      deleted_at,
      deleted_by
    )
    select
      afr.org_id,
      afr.recipient_profile_id,
      case
        when (event_payload ->> 'scheduleId') ~* '^[0-9a-f-]{36}$'
          then (event_payload ->> 'scheduleId')::uuid
        else null
      end as class_session_id,
      case
        when (event_payload ->> 'learningSpaceId') ~* '^[0-9a-f-]{36}$'
          then (event_payload ->> 'learningSpaceId')::uuid
        else null
      end as classroom_id,
      case
        when (event_payload ->> 'channelId') ~* '^[0-9a-f-]{36}$'
          then (event_payload ->> 'channelId')::uuid
        else null
      end as channel_id,
      afr.message_id,
      afr.source_event_id,
      case
        when event_payload ? 'occurrenceStart'
          and coalesce(event_payload ->> 'occurrenceStart', '') <> ''
          and (event_payload ->> 'occurrenceStart') ~ '^\d{4}-\d{2}-\d{2}T'
          then (event_payload ->> 'occurrenceStart')::timestamptz
        else null
      end as occurrence_start_at,
      afr.rating,
      afr.comment,
      afr.submitted_at,
      afr.created_at,
      afr.created_by,
      afr.updated_at,
      afr.updated_by,
      afr.deleted_at,
      afr.deleted_by
    from public.activity_feedback_responses afr
    left join public.activity_events ae
      on ae.id = afr.source_event_id
    cross join lateral (
      select case
        when ae.payload is null then '{}'::jsonb
        when jsonb_typeof(ae.payload) = 'object' then ae.payload
        else '{}'::jsonb
      end as event_payload
    ) payload
    where
      (event_payload ->> 'scheduleId') ~* '^[0-9a-f-]{36}$'
      and (event_payload ->> 'learningSpaceId') ~* '^[0-9a-f-]{36}$'
      and (event_payload ->> 'channelId') ~* '^[0-9a-f-]{36}$'
    on conflict (org_id, recipient_profile_id, class_session_id) do update
      set
        rating = excluded.rating,
        comment = excluded.comment,
        submitted_at = greatest(
          coalesce(public.message_session_feedback.submitted_at, excluded.submitted_at),
          excluded.submitted_at
        ),
        message_id = coalesce(public.message_session_feedback.message_id, excluded.message_id),
        source_event_id = coalesce(
          public.message_session_feedback.source_event_id,
          excluded.source_event_id
        ),
        occurrence_start_at = coalesce(
          public.message_session_feedback.occurrence_start_at,
          excluded.occurrence_start_at
        ),
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by,
        deleted_at = null,
        deleted_by = null;

    drop table public.activity_feedback_responses;
  end if;
end $$;
