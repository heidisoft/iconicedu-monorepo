do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'message_type'
      and e.enumlabel = 'live-session-started'
  ) then
    alter type public.message_type add value 'live-session-started';
  end if;
end
$$;
