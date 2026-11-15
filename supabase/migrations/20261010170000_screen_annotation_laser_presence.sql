-- API-authorized laser previews for signed-in and shared-link participants.
create table public.screen_annotation_lasers (
  room_id uuid not null references public.screen_annotation_sessions(id) on delete cascade,
  user_id uuid not null,
  strokes jsonb not null default '[]'::jsonb check (
    jsonb_typeof(strokes) = 'array' and jsonb_array_length(strokes) <= 8
  ),
  expires_at timestamptz not null,
  primary key (room_id, user_id)
);
alter table public.screen_annotation_lasers enable row level security;
revoke all on public.screen_annotation_lasers from anon, authenticated;
grant all on public.screen_annotation_lasers to service_role;
