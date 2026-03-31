create or replace function public.storage_channel_file_profile_id(path text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(path, '/', 4), '')::uuid;
$$;
