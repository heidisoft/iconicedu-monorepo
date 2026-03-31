drop policy if exists "messages insert by member or system" on public.messages;

create policy "messages insert by member or system"
  on public.messages
  for insert
  with check (
    deleted_at is null
    and public.can_insert_message(org_id, channel_id, sender_profile_id, type)
  );
