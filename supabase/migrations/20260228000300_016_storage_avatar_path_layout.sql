create or replace function public.storage_avatar_profile_id(path text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(path, '/', 3), '')::uuid;
$$;
