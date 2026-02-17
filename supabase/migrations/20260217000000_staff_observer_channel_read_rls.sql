-- Allow staff to read channels/messages they do not participate in, while keeping those views read-only.

create or replace function public.can_staff_observe_channel(_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels c
    join public.accounts a
      on a.org_id = c.org_id
     and a.deleted_at is null
    left join public.user_roles ur
      on ur.org_id = c.org_id
     and ur.account_id = a.id
     and ur.deleted_at is null
     and ur.role_key = 'staff'
    left join public.profiles p
      on p.org_id = c.org_id
     and p.account_id = a.id
     and p.deleted_at is null
    where c.id = _channel_id
      and c.deleted_at is null
      and a.auth_user_id = auth.uid()
      and (
        ur.id is not null
        or p.kind = 'staff'
      )
      and not public.is_channel_member(c.id)
  );
$$;

create or replace function public.can_staff_observe_message(_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.messages m
    where m.id = _message_id
      and m.deleted_at is null
      and public.can_staff_observe_channel(m.channel_id)
  );
$$;

create policy "channels read staff observer"
  on public.channels
  for select
  using (deleted_at is null and public.can_staff_observe_channel(id));

create policy "channel members read staff observer"
  on public.channel_members
  for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "channel capabilities read staff observer"
  on public.channel_capabilities
  for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "messages read staff observer"
  on public.messages
  for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "threads read staff observer"
  on public.threads
  for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "thread participants read staff observer"
  on public.thread_participants
  for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and public.can_staff_observe_channel(t.channel_id)
    )
  );

create policy "message_text read staff observer"
  on public.message_text
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_image read staff observer"
  on public.message_image
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_file read staff observer"
  on public.message_file
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_design_file_update read staff observer"
  on public.message_design_file_update
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_payment_reminder read staff observer"
  on public.message_payment_reminder
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_event_reminder read staff observer"
  on public.message_event_reminder
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_feedback_request read staff observer"
  on public.message_feedback_request
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_lesson_assignment read staff observer"
  on public.message_lesson_assignment
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_progress_update read staff observer"
  on public.message_progress_update
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_session_booking read staff observer"
  on public.message_session_booking
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_session_complete read staff observer"
  on public.message_session_complete
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_session_summary read staff observer"
  on public.message_session_summary
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_homework_submission read staff observer"
  on public.message_homework_submission
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_link_preview read staff observer"
  on public.message_link_preview
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message_audio_recording read staff observer"
  on public.message_audio_recording
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message reactions read staff observer"
  on public.message_reactions
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "message reaction counts read staff observer"
  on public.message_reaction_counts
  for select
  using (deleted_at is null and public.can_staff_observe_message(message_id));

create policy "channel media read staff observer"
  on public.channel_media
  for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "channel files read staff observer"
  on public.channel_files
  for select
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

drop policy if exists "messages update sender or manager" on public.messages;
create policy "messages update sender or manager"
  on public.messages
  for update
  using (
    deleted_at is null
    and (
      exists (
        select 1
        from public.profiles p
        join public.accounts a on a.id = p.account_id
        where p.id = sender_profile_id
          and a.auth_user_id = auth.uid()
          and p.deleted_at is null
          and a.deleted_at is null
      )
      or public.is_org_admin(org_id)
    )
  )
  with check (
    (
      deleted_at is not null
      and (
        exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = sender_profile_id
            and a.auth_user_id = auth.uid()
            and p.deleted_at is null
            and a.deleted_at is null
        )
        or public.is_org_admin(org_id)
      )
    )
    or (
      deleted_at is null
      and (
        exists (
          select 1
          from public.profiles p
          join public.accounts a on a.id = p.account_id
          where p.id = sender_profile_id
            and a.auth_user_id = auth.uid()
            and p.deleted_at is null
            and a.deleted_at is null
        )
        or public.is_org_admin(org_id)
      )
    )
  );

drop policy if exists "messages delete sender or manager" on public.messages;
create policy "messages delete sender or manager"
  on public.messages
  for delete
  using (
    deleted_at is null
    and (
      exists (
        select 1
        from public.profiles p
        join public.accounts a on a.id = p.account_id
        where p.id = sender_profile_id
          and a.auth_user_id = auth.uid()
          and p.deleted_at is null
          and a.deleted_at is null
      )
      or public.is_org_admin(org_id)
    )
  );
