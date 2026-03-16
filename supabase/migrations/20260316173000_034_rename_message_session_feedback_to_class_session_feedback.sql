do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'message_session_feedback'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'class_session_feedback'
  ) then
    alter table public.message_session_feedback
      rename to class_session_feedback;
  end if;
end $$;

alter index if exists public.message_session_feedback_org_profile_submitted_idx
  rename to class_session_feedback_org_profile_submitted_idx;

alter index if exists public.message_session_feedback_org_session_idx
  rename to class_session_feedback_org_session_idx;

alter index if exists public.message_session_feedback_org_message_idx
  rename to class_session_feedback_org_message_idx;

alter index if exists public.message_session_feedback_org_event_idx
  rename to class_session_feedback_org_event_idx;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'class_session_feedback'
      and policyname = 'message session feedback self'
  ) then
    execute 'alter policy "message session feedback self" on public.class_session_feedback rename to "class session feedback self"';
  end if;
end $$;
