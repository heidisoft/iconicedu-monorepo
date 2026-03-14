do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'channel_purpose'
      and e.enumlabel = 'chass-requests'
  ) then
    alter type public.channel_purpose add value 'chass-requests';
  end if;
end
$$;
