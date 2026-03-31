create or replace function public.can_act_as_profile(
  _org_id uuid,
  _profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _profile_id
      and p.org_id = _org_id
      and p.deleted_at is null
      and (
        public.is_profile_owner(p.id)
        or exists (
          select 1
          from public.family_links fl
          where fl.org_id = _org_id
            and fl.child_account_id = p.account_id
            and fl.guardian_account_id = public.current_account_id()
            and fl.deleted_at is null
        )
      )
  );
$$;

create or replace function public.can_post_to_channel_as_profile(
  _org_id uuid,
  _channel_id uuid,
  _profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_act_as_profile(_org_id, _profile_id)
    and (
      exists (
        select 1
        from public.channel_members cm
        where cm.channel_id = _channel_id
          and cm.profile_id = _profile_id
          and cm.deleted_at is null
      )
      or exists (
        select 1
        from public.channels c
        where c.id = _channel_id
          and c.org_id = _org_id
          and c.purpose = 'support'
          and c.deleted_at is null
          and public.is_org_member(_org_id)
      )
    );
$$;

create or replace function public.can_insert_message(
  _org_id uuid,
  _channel_id uuid,
  _sender_profile_id uuid,
  _type public.message_type
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      auth.role() = 'service_role'
      and _type in ('event-reminder', 'feedback-request', 'payment-reminder')
      and exists (
        select 1
        from public.profiles p
        where p.id = _sender_profile_id
          and p.org_id = _org_id
          and p.kind = 'system'
          and p.deleted_at is null
      )
    )
    or public.can_post_to_channel_as_profile(_org_id, _channel_id, _sender_profile_id);
$$;

create or replace function public.can_write_message(_message_id uuid)
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
      and public.can_insert_message(m.org_id, m.channel_id, m.sender_profile_id, m.type)
  );
$$;

create policy "message text insert by write access"
  on public.message_text for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message image insert by write access"
  on public.message_image for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message file insert by write access"
  on public.message_file for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message design file update insert by write access"
  on public.message_design_file_update for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message payment reminder insert by write access"
  on public.message_payment_reminder for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message event reminder insert by write access"
  on public.message_event_reminder for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message feedback request insert by write access"
  on public.message_feedback_request for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message lesson assignment insert by write access"
  on public.message_lesson_assignment for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message progress update insert by write access"
  on public.message_progress_update for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message session booking insert by write access"
  on public.message_session_booking for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message session complete insert by write access"
  on public.message_session_complete for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message session summary insert by write access"
  on public.message_session_summary for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message homework submission insert by write access"
  on public.message_homework_submission for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message link preview insert by write access"
  on public.message_link_preview for insert
  with check (deleted_at is null and public.can_write_message(message_id));

create policy "message audio recording insert by write access"
  on public.message_audio_recording for insert
  with check (deleted_at is null and public.can_write_message(message_id));
