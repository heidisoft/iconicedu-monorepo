-- Close secondary-data paths for restricted channel messages and preserve the
-- dedicated support-channel audience model. This is a forward correction to
-- 20261114000000_channel_message_audience_integrity.sql.

create or replace function public.enforce_message_audience_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent public.messages%rowtype;
  v_channel_purpose text;
begin
  select c.purpose::text into v_channel_purpose
    from public.channels c
   where c.id = new.channel_id
     and c.org_id = new.org_id
     and c.deleted_at is null;

  if tg_op = 'UPDATE' and (
    new.visibility_type is distinct from old.visibility_type
    or new.visibility_user_id is distinct from old.visibility_user_id
    or new.visibility_user_ids is distinct from old.visibility_user_ids
  ) then
    raise exception 'message audience is immutable' using errcode = '22023';
  end if;

  -- Support conversations intentionally recalculate their staff audience for
  -- every reply so staff added after the original question can participate.
  if tg_op = 'INSERT'
     and v_channel_purpose is distinct from 'support'
     and new.thread_parent_id is not null then
    select * into v_parent
      from public.messages
     where id = new.thread_parent_id
       and org_id = new.org_id
       and channel_id = new.channel_id
       and deleted_at is null;

    if not found then
      raise exception 'thread parent message was not found' using errcode = '23503';
    end if;

    new.visibility_type := v_parent.visibility_type;
    new.visibility_user_id := v_parent.visibility_user_id;
    new.visibility_user_ids := v_parent.visibility_user_ids;
  elsif tg_op = 'INSERT'
        and v_channel_purpose is distinct from 'support'
        and new.reply_to_message_id is not null then
    select * into v_parent
      from public.messages
     where id = new.reply_to_message_id
       and org_id = new.org_id
       and channel_id = new.channel_id
       and deleted_at is null;

    if not found then
      raise exception 'referenced message was not found' using errcode = '23503';
    end if;

    if v_parent.visibility_type = 'specific-users' then
      new.visibility_type := v_parent.visibility_type;
      new.visibility_user_id := v_parent.visibility_user_id;
      new.visibility_user_ids := v_parent.visibility_user_ids;
    end if;
  end if;

  if new.visibility_type = 'specific-users' then
    if coalesce(cardinality(new.visibility_user_ids), 0) = 0 then
      raise exception 'specific-users audience cannot be empty' using errcode = '22023';
    end if;
    if not (new.sender_profile_id = any(new.visibility_user_ids)) then
      raise exception 'message sender must belong to the audience' using errcode = '22023';
    end if;
    new.visibility_user_id := null;
  elsif new.visibility_type = 'all' then
    new.visibility_user_id := null;
    new.visibility_user_ids := null;
  end if;

  return new;
end;
$$;

-- Staff observers retain their established read-only access to public channel
-- messages, but restricted messages are visible only when their account owns
-- one of the explicit audience profiles.
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
      and (
        m.visibility_type = 'all'
        or (
          m.visibility_type = 'sender-only'
          and public.is_profile_owner(m.sender_profile_id)
        )
        or (
          m.visibility_type = 'recipient-only'
          and exists (
            select 1 from public.profiles p
            where p.id = m.visibility_user_id
              and p.account_id = public.current_account_id()
              and p.deleted_at is null
          )
        )
        or (
          m.visibility_type = 'specific-users'
          and exists (
            select 1 from public.profiles p
            where p.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
              and p.account_id = public.current_account_id()
              and p.deleted_at is null
          )
        )
      )
  );
$$;

drop policy if exists "messages read staff observer" on public.messages;
drop policy if exists "messages select staff observer" on public.messages;
create policy "messages read staff observer"
  on public.messages for select to authenticated
  using (deleted_at is null and public.can_staff_observe_message(id));

create or replace function public.can_access_thread(_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.threads t
    where t.id = _thread_id
      and t.deleted_at is null
      and (
        public.can_access_message(t.parent_message_id)
        or public.can_supervise_message(t.parent_message_id)
        or public.can_staff_observe_message(t.parent_message_id)
      )
  );
$$;

drop policy if exists "threads select by member" on public.threads;
drop policy if exists "threads select supervised guardian" on public.threads;
drop policy if exists "threads select staff observer" on public.threads;
drop policy if exists "threads read supervised guardian" on public.threads;
drop policy if exists "threads read staff observer" on public.threads;
drop policy if exists "threads write by member" on public.threads;

create policy "threads select by parent audience"
  on public.threads for select to authenticated
  using (public.can_access_thread(id));

create policy "threads insert by parent audience"
  on public.threads for insert to authenticated
  with check (
    deleted_at is null
    and (
      public.can_access_message(parent_message_id)
      or public.can_supervise_message(parent_message_id)
      or public.can_staff_observe_message(parent_message_id)
    )
  );

create policy "threads update by parent audience"
  on public.threads for update to authenticated
  using (public.can_access_thread(id))
  with check (
    deleted_at is null
    and (
      public.can_access_message(parent_message_id)
      or public.can_supervise_message(parent_message_id)
      or public.can_staff_observe_message(parent_message_id)
    )
  );

create policy "threads delete by parent audience"
  on public.threads for delete to authenticated
  using (public.can_access_thread(id));

drop policy if exists "thread participants select by member" on public.thread_participants;
drop policy if exists "thread participants select supervised guardian" on public.thread_participants;
drop policy if exists "thread participants select staff observer" on public.thread_participants;
drop policy if exists "thread participants read supervised guardian" on public.thread_participants;
drop policy if exists "thread participants read staff observer" on public.thread_participants;
drop policy if exists "thread participants write by member" on public.thread_participants;

create policy "thread participants select by parent audience"
  on public.thread_participants for select to authenticated
  using (deleted_at is null and public.can_access_thread(thread_id));

create policy "thread participants insert by parent audience"
  on public.thread_participants for insert to authenticated
  with check (deleted_at is null and public.can_access_thread(thread_id));

create policy "thread participants update by parent audience"
  on public.thread_participants for update to authenticated
  using (deleted_at is null and public.can_access_thread(thread_id))
  with check (deleted_at is null and public.can_access_thread(thread_id));

create policy "thread participants delete by parent audience"
  on public.thread_participants for delete to authenticated
  using (deleted_at is null and public.can_access_thread(thread_id));

-- Asset metadata follows the associated message instead of broad channel
-- membership. Service-role API writes continue to bypass RLS.
drop policy if exists "channel media all by member" on public.channel_media;
drop policy if exists "channel media select by member" on public.channel_media;
drop policy if exists "channel media select supervised guardian" on public.channel_media;
drop policy if exists "channel media select staff observer" on public.channel_media;
drop policy if exists "channel media read staff observer" on public.channel_media;

create policy "channel media select by message audience"
  on public.channel_media for select to authenticated
  using (
    deleted_at is null
    and message_id is not null
    and (
      public.can_access_message(message_id)
      or public.can_supervise_message(message_id)
      or public.can_staff_observe_message(message_id)
    )
  );

create policy "channel media insert by message audience"
  on public.channel_media for insert to authenticated
  with check (deleted_at is null and public.can_access_message(message_id));

create policy "channel media update by message audience"
  on public.channel_media for update to authenticated
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

create policy "channel media delete by message audience"
  on public.channel_media for delete to authenticated
  using (deleted_at is null and public.can_access_message(message_id));

drop policy if exists "channel files all by member" on public.channel_files;
drop policy if exists "channel files select by member" on public.channel_files;
drop policy if exists "channel files select supervised guardian" on public.channel_files;
drop policy if exists "channel files select staff observer" on public.channel_files;
drop policy if exists "channel files read staff observer" on public.channel_files;

create policy "channel files select by message audience"
  on public.channel_files for select to authenticated
  using (
    deleted_at is null
    and message_id is not null
    and (
      public.can_access_message(message_id)
      or public.can_supervise_message(message_id)
      or public.can_staff_observe_message(message_id)
    )
  );

create policy "channel files insert by message audience"
  on public.channel_files for insert to authenticated
  with check (deleted_at is null and public.can_access_message(message_id));

create policy "channel files update by message audience"
  on public.channel_files for update to authenticated
  using (deleted_at is null and public.can_access_message(message_id))
  with check (deleted_at is null and public.can_access_message(message_id));

create policy "channel files delete by message audience"
  on public.channel_files for delete to authenticated
  using (deleted_at is null and public.can_access_message(message_id));

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
      )
  );
$$;

revoke all on function public.can_access_channel_file_object(text) from public;
grant execute on function public.can_access_channel_file_object(text) to authenticated;

drop policy if exists "channel files: org members read" on storage.objects;
create policy "channel files: message audience read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'channel-files'
  and public.can_access_channel_file_object(name)
);
