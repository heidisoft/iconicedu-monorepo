-- Safeguarding: org staff (owners, admins, staff) may read every restricted
-- ("private") channel message in channels they can already see, read-only.
--
-- This deliberately widens 20261117000000_channel_message_audience_privacy_hardening.sql,
-- which limited staff observers to restricted messages addressed to them.
--
-- Read-only is enforced by adding the new predicate to SELECT policies only.
-- Every write path (messages insert trigger, content writes, reactions, thread
-- metadata) keeps using can_access_message / can_access_thread, so staff
-- outside the audience still cannot reply, react, or create threads.
-- Support channels keep their dedicated audience model.

create or replace function public.is_current_account_org_staff(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.accounts a
    left join public.user_roles ur
      on ur.org_id = a.org_id
     and ur.account_id = a.id
     and ur.role_key in ('owner', 'admin', 'staff')
     and ur.deleted_at is null
    left join public.profiles p
      on p.org_id = a.org_id
     and p.account_id = a.id
     and p.deleted_at is null
    where a.org_id = _org_id
      and a.auth_user_id = auth.uid()
      and a.deleted_at is null
      and (
        ur.id is not null
        or p.kind = 'staff'
        or a.primary_role in ('owner', 'admin', 'staff')
      )
  );
$$;

create or replace function public.can_staff_review_message(_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.messages m
    join public.channels c
      on c.id = m.channel_id
     and c.deleted_at is null
    where m.id = _message_id
      and m.deleted_at is null
      and m.visibility_type <> 'all'
      and c.purpose is distinct from 'support'
      and public.is_current_account_org_staff(m.org_id)
      and (
        public.is_channel_member(m.channel_id)
        or public.can_staff_observe_channel(m.channel_id)
      )
  );
$$;

revoke all on function public.is_current_account_org_staff(uuid) from public;
revoke all on function public.can_staff_review_message(uuid) from public;
grant execute on function public.is_current_account_org_staff(uuid) to authenticated, service_role;
grant execute on function public.can_staff_review_message(uuid) to authenticated, service_role;

drop policy if exists "messages read staff review" on public.messages;
create policy "messages read staff review"
  on public.messages for select to authenticated
  using (deleted_at is null and public.can_staff_review_message(id));

-- Every message content table (and reactions / media / files) that already
-- grants staff observers read access gets the matching review policy.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'channel_files',
    'channel_media',
    'message_audio_recording',
    'message_design_file_update',
    'message_event_reminder',
    'message_feedback_request',
    'message_file',
    'message_homework_submission',
    'message_image',
    'message_lesson_assignment',
    'message_link_preview',
    'message_live_session_started',
    'message_payment_reminder',
    'message_progress_update',
    'message_reaction_counts',
    'message_reactions',
    'message_session_booking',
    'message_session_complete',
    'message_session_summary',
    'message_text'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', v_table || ' select staff review', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (deleted_at is null and message_id is not null and public.can_staff_review_message(message_id))',
      v_table || ' select staff review',
      v_table
    );
  end loop;
end;
$$;

drop policy if exists "threads select staff review" on public.threads;
create policy "threads select staff review"
  on public.threads for select to authenticated
  using (deleted_at is null and public.can_staff_review_message(parent_message_id));

drop policy if exists "thread participants select staff review" on public.thread_participants;
create policy "thread participants select staff review"
  on public.thread_participants for select to authenticated
  using (
    exists (
      select 1
      from public.threads t
      where t.id = thread_participants.thread_id
        and t.deleted_at is null
        and public.can_staff_review_message(t.parent_message_id)
    )
  );

-- Attachments of reviewable messages must be downloadable too. This function
-- backs only the storage SELECT policy.
create or replace function public.can_access_channel_file_object(_path text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
    from public.channel_files f
    where f.url = _path
      and f.deleted_at is null
      and (
        public.can_access_message(f.message_id)
        or public.can_supervise_message(f.message_id)
        or public.can_staff_observe_message(f.message_id)
        or public.can_staff_review_message(f.message_id)
      )
  )
  or exists (
    select 1
    from public.channel_media m
    where m.url = _path
      and m.deleted_at is null
      and (
        public.can_access_message(m.message_id)
        or public.can_supervise_message(m.message_id)
        or public.can_staff_observe_message(m.message_id)
        or public.can_staff_review_message(m.message_id)
      )
  )
  or exists (
    select 1
    from public.message_audio_recording a
    where a.deleted_at is null
      and (a.payload ->> 'storagePath' = _path or a.payload ->> 'url' = _path)
      and (
        public.can_access_message(a.message_id)
        or public.can_supervise_message(a.message_id)
        or public.can_staff_observe_message(a.message_id)
        or public.can_staff_review_message(a.message_id)
      )
  );
$$;
