alter table public.class_schedule_recurrence_exceptions
  add column if not exists suppress_notifications boolean not null default false;

alter table public.class_schedule_recurrence_overrides
  add column if not exists suppress_notifications boolean not null default false;
