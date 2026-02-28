create or replace function public.storage_channel_file_org_id(path text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(path, '/', 1), '')::uuid;
$$;

create or replace function public.storage_channel_file_profile_id(path text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(path, '/', 3), '')::uuid;
$$;

insert into storage.buckets (id, name, public)
values ('channel-files', 'channel-files', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "channel files: insert own folder" on storage.objects;
drop policy if exists "channel files: org members read" on storage.objects;

create policy "channel files: insert own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'channel-files'
  and exists (
    select 1
    from public.profiles p
    join public.accounts a on a.id = p.account_id
    where p.id = public.storage_channel_file_profile_id(name)
      and p.org_id = public.storage_channel_file_org_id(name)
      and a.auth_user_id = auth.uid()
      and p.deleted_at is null
      and a.deleted_at is null
  )
);

create policy "channel files: org members read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'channel-files'
  and public.is_org_member(public.storage_channel_file_org_id(name))
);
