create or replace function public.storage_protect_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), 'false') != 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
      using hint = 'This prevents accidental data loss from orphaned objects.',
            errcode = '42501';
  end if;

  return null;
end;
$$;
