-- Allow guardians to read supervised DM/group DM channels for linked children.
-- Minimal scope: SELECT on channels only, via existing can_supervise_channel helper.

drop policy if exists "channels select supervised guardian" on public.channels;

create policy "channels select supervised guardian"
  on public.channels for select
  using (deleted_at is null and public.can_supervise_channel(id));
