-- Ephemeral cursor presence shared by authenticated and capability-authorized guests.
-- Only the API service role may access it; room/actor authorization precedes every call.
create table public.screen_annotation_pointers (
  room_id uuid not null references public.screen_annotation_sessions(id) on delete cascade,
  user_id uuid not null,
  name text not null check (length(name) between 1 and 100),
  role text not null check (role in ('educator', 'student')),
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  tool text not null check (tool in ('spotlight', 'pointerArrow')),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  expires_at timestamptz not null,
  primary key (room_id, user_id)
);
alter table public.screen_annotation_pointers enable row level security;
revoke all on public.screen_annotation_pointers from anon, authenticated;
grant all on public.screen_annotation_pointers to service_role;
