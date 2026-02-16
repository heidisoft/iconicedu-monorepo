-- Allow guardians to read (not write) their children's direct-message channels/messages.
-- Scope is limited to DM/group DM channels where a linked child is a participant.

create or replace function public.can_supervise_channel(_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels c
    join public.channel_members cm
      on cm.channel_id = c.id
     and cm.deleted_at is null
    join public.profiles p
      on p.id = cm.profile_id
     and p.deleted_at is null
    join public.accounts child_account
      on child_account.id = p.account_id
     and child_account.deleted_at is null
    join public.family_links fl
      on fl.org_id = c.org_id
     and fl.child_account_id = child_account.id
     and fl.deleted_at is null
    where c.id = _channel_id
      and c.deleted_at is null
      and c.kind in ('dm', 'group_dm')
      and fl.guardian_account_id = public.current_account_id()
  );
$$;

create or replace function public.can_supervise_message(_message_id uuid)
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
      and public.can_supervise_channel(m.channel_id)
  );
$$;

create policy "channel members read supervised guardian"
  on public.channel_members
  for select
  using (deleted_at is null and public.can_supervise_channel(channel_id));

create policy "messages read supervised guardian"
  on public.messages
  for select
  using (deleted_at is null and public.can_supervise_channel(channel_id));

create policy "threads read supervised guardian"
  on public.threads
  for select
  using (deleted_at is null and public.can_supervise_channel(channel_id));

create policy "thread participants read supervised guardian"
  on public.thread_participants
  for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and public.can_supervise_channel(t.channel_id)
    )
  );

create policy "message_text read supervised guardian"
  on public.message_text
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_image read supervised guardian"
  on public.message_image
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_file read supervised guardian"
  on public.message_file
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_design_file_update read supervised guardian"
  on public.message_design_file_update
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_payment_reminder read supervised guardian"
  on public.message_payment_reminder
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_event_reminder read supervised guardian"
  on public.message_event_reminder
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_feedback_request read supervised guardian"
  on public.message_feedback_request
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_lesson_assignment read supervised guardian"
  on public.message_lesson_assignment
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_progress_update read supervised guardian"
  on public.message_progress_update
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_session_booking read supervised guardian"
  on public.message_session_booking
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_session_complete read supervised guardian"
  on public.message_session_complete
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_session_summary read supervised guardian"
  on public.message_session_summary
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_homework_submission read supervised guardian"
  on public.message_homework_submission
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_link_preview read supervised guardian"
  on public.message_link_preview
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_audio_recording read supervised guardian"
  on public.message_audio_recording
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_reactions read supervised guardian"
  on public.message_reactions
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));

create policy "message_reaction_counts read supervised guardian"
  on public.message_reaction_counts
  for select
  using (deleted_at is null and public.can_supervise_message(message_id));
