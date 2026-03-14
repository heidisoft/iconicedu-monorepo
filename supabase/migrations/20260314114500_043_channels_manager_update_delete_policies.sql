-- Replace the broad manager policy with explicit update/delete policies.
-- This keeps insert behavior on the dedicated "channels insert by manager"
-- policy and allows soft-delete updates by staff/educator managers.
drop policy if exists "channels all by manager" on public.channels;

create policy "channels update by manager"
  on public.channels for update
  using (deleted_at is null and public.can_manage_channel(id))
  with check (public.can_manage_in_org(public.channels.org_id));

create policy "channels delete by manager"
  on public.channels for delete
  using (deleted_at is null and public.can_manage_channel(id));
