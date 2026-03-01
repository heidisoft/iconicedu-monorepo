create or replace function public.storage_message_thumbnail_org_id(path text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(path, '/', 1), '')::uuid;
$$;

create or replace function public.storage_message_thumbnail_profile_id(path text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(path, '/', 4), '')::uuid;
$$;

insert into storage.buckets (id, name, public)
values ('public-message-thumbnails', 'public-message-thumbnails', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "message thumbnails: insert own folder" on storage.objects;

create policy "message thumbnails: insert own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'public-message-thumbnails'
  and exists (
    select 1
    from public.profiles p
    join public.accounts a on a.id = p.account_id
    where p.id = public.storage_message_thumbnail_profile_id(name)
      and p.org_id = public.storage_message_thumbnail_org_id(name)
      and a.auth_user_id = auth.uid()
      and p.deleted_at is null
      and a.deleted_at is null
  )
);
