-- Issue #264 (messaging P0): allow a sender to edit their own text message
-- within a short window. `message_text write by access` previously granted
-- UPDATE to any channel member who could read the message (via
-- can_access_message), which was never exercised because no edit feature
-- existed. Split it into command-specific policies so UPDATE is scoped to
-- the sender, within the edit window, on a text message only.

create or replace function public.can_edit_message_text(_message_id uuid, _window_minutes int)
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
      and m.type = 'text'
      and m.deleted_at is null
      and public.is_profile_owner(m.sender_profile_id)
      and m.created_at >= now() - (_window_minutes || ' minutes')::interval
  );
$$;

drop policy if exists "message text write by access" on public.message_text;

create policy "message text insert by access"
  on public.message_text for insert
  to authenticated
  with check (deleted_at is null and public.can_access_message(message_id));

create policy "message text update by sender within edit window"
  on public.message_text for update
  to authenticated
  using (deleted_at is null and public.can_edit_message_text(message_id, 15))
  with check (deleted_at is null and public.can_edit_message_text(message_id, 15));

create policy "message text delete by access"
  on public.message_text for delete
  to authenticated
  using (deleted_at is null and public.can_access_message(message_id));
