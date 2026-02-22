alter table if exists public.channels
  add column if not exists ui_theme_key text;

