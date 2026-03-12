-- ---------------------------------------------------------------------------
-- Fix RLS INSERT violations for learning_spaces, channels, class_schedules
--
-- Root cause: can_manage_learning_space(id), can_manage_channel(id), and
-- can_manage_schedule(id) all JOIN back to their own table by ID.  On INSERT
-- the new row does not yet exist in the table, so those functions always
-- return false, causing the WITH CHECK on the FOR ALL policy to fail.
--
-- Fix: add a can_manage_in_org(org_id) helper that checks role membership
-- purely by org_id (available in the new row) and add separate FOR INSERT
-- policies for the three affected tables.  Permissive RLS means "any one
-- policy allows → row passes", so the new INSERT policies work alongside the
-- existing FOR ALL policies that handle SELECT / UPDATE / DELETE correctly.
-- ---------------------------------------------------------------------------

-- Helper: is the current user an org-level manager (admin/owner) or a
-- staff/educator in the given org?  Works for INSERT checks where the entity
-- row itself does not yet exist.
create or replace function public.can_manage_in_org(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin(_org_id)
  or exists (
    select 1
    from public.user_roles ur
    join public.accounts a on a.id = ur.account_id
    where ur.org_id = _org_id
      and a.auth_user_id = auth.uid()
      and ur.role_key in ('staff', 'educator')
      and ur.deleted_at is null
      and a.deleted_at is null
  );
$$;

-- learning_spaces INSERT: check org_id on the new row directly
create policy "learning spaces insert by manager"
  on public.learning_spaces for insert
  with check (
    deleted_at is null
    and public.can_manage_in_org(org_id)
  );

-- channels INSERT: check org_id on the new row directly
create policy "channels insert by manager"
  on public.channels for insert
  with check (
    deleted_at is null
    and public.can_manage_in_org(org_id)
  );

-- class_schedules INSERT: check org_id on the new row directly
create policy "class schedules insert by manager"
  on public.class_schedules for insert
  with check (
    deleted_at is null
    and public.can_manage_in_org(org_id)
  );
