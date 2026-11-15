-- Issue #264 (messaging P2): message pinning. Authorized roles (staff,
-- educators, org admins — same authorization as can_manage_channel) can pin
-- a limited number of messages per channel for a dedicated pinned surface.
-- Soft-delete-based toggle, same pattern as message_saves.

create table public.message_pins (
  id uuid primary key default uuid_generate_v7(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

create unique index message_pins_org_channel_message_active_idx
  on public.message_pins (org_id, channel_id, message_id)
  where deleted_at is null;

create index message_pins_channel_active_idx
  on public.message_pins (org_id, channel_id, created_at desc)
  where deleted_at is null;

alter table public.message_pins enable row level security;

create policy "message pins select by access"
  on public.message_pins for select
  to authenticated
  using (deleted_at is null and public.is_channel_member(channel_id));

create policy "message pins select supervised guardian"
  on public.message_pins for select
  to authenticated
  using (deleted_at is null and public.can_supervise_channel(channel_id));

create policy "message pins select staff observer"
  on public.message_pins for select
  to authenticated
  using (deleted_at is null and public.can_staff_observe_channel(channel_id));

create policy "message pins write by channel manager"
  on public.message_pins for all
  to authenticated
  using (deleted_at is null and public.can_manage_channel(channel_id))
  with check (deleted_at is null and public.can_manage_channel(channel_id));
