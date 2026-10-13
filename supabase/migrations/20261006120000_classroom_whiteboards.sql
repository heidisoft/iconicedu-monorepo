-- Application-owned boards are scoped to a class occurrence, independent of video providers.
create table public.classroom_whiteboards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  scope_key text not null,
  revision integer not null default 0,
  document jsonb not null,
  applied_operations jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (org_id, channel_id, scope_key)
);
create table public.classroom_whiteboard_access (
  token_hash text primary key,
  board_id uuid not null references public.classroom_whiteboards(id) on delete cascade,
  live_session_id uuid not null references public.channel_live_sessions(id) on delete cascade,
  role text not null check (role in ('teacher','student')),
  display_name text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index classroom_whiteboard_access_presence_idx on public.classroom_whiteboard_access(board_id, last_seen_at);
alter table public.classroom_whiteboards enable row level security;
alter table public.classroom_whiteboard_access enable row level security;
-- No frontend table access. All mutations and presence pass through API capability checks.
revoke all on public.classroom_whiteboards, public.classroom_whiteboard_access from anon, authenticated;
grant all on public.classroom_whiteboards, public.classroom_whiteboard_access to service_role;

-- Compare-and-swap is atomic; API retries an operation against fresh state after a conflict.
create function public.commit_classroom_whiteboard(p_board_id uuid, p_revision integer, p_document jsonb, p_operation_id text)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  update public.classroom_whiteboards
  set document = p_document, revision = revision + 1, updated_at = now(),
      applied_operations = (select coalesce(jsonb_agg(value), '[]'::jsonb) from (select value from jsonb_array_elements(applied_operations || jsonb_build_array(p_operation_id)) with ordinality as ops(value, position) order by position desc limit 256) recent)
  where id = p_board_id and revision = p_revision;
  return found;
end;
$$;
revoke all on function public.commit_classroom_whiteboard(uuid,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.commit_classroom_whiteboard(uuid,integer,jsonb,text) to service_role;
