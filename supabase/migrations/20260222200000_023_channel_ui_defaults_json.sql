alter table public.channels
  add column if not exists ui_defaults jsonb;
