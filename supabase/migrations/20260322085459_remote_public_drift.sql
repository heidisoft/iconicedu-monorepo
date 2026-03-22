alter table public.profiles
  alter column avatar_source drop not null,
  alter column timezone drop not null,
  alter column ui_theme_key set default 'green'::text;

alter table public.staff_profiles
  add column if not exists weekly_availability jsonb;

do $$
declare
  has_working_hours_schedule boolean;
  has_working_hours_rules boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff_profiles'
      and column_name = 'working_hours_schedule'
  )
  into has_working_hours_schedule;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff_profiles'
      and column_name = 'working_hours_rules'
  )
  into has_working_hours_rules;

  if has_working_hours_schedule and has_working_hours_rules then
    execute $sql$
      update public.staff_profiles
      set weekly_availability = coalesce(
        weekly_availability,
        working_hours_schedule,
        to_jsonb(working_hours_rules)
      )
      where weekly_availability is null
        and (working_hours_schedule is not null or working_hours_rules is not null)
    $sql$;
  elsif has_working_hours_schedule then
    execute $sql$
      update public.staff_profiles
      set weekly_availability = coalesce(weekly_availability, working_hours_schedule)
      where weekly_availability is null
        and working_hours_schedule is not null
    $sql$;
  elsif has_working_hours_rules then
    execute $sql$
      update public.staff_profiles
      set weekly_availability = coalesce(weekly_availability, to_jsonb(working_hours_rules))
      where weekly_availability is null
        and working_hours_rules is not null
    $sql$;
  end if;
end
$$;

alter table public.staff_profiles
  drop column if exists working_hours_schedule,
  drop column if exists working_hours_rules;

