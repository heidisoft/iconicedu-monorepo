-- Fix three gaps introduced by or not covered by migration 033 (full RLS reset).

-- 1. user_roles: allow any authenticated user to read their own role assignments.
--    All writes to user_roles continue to go through service_role API routes only.
create policy "user roles select self"
  on public.user_roles
  for select
  using (
    deleted_at is null
    and account_id = public.current_account_id()
  );

-- 2. message_reaction_counts: the mobile app writes these directly with user JWT
--    (INSERT first count, UPDATE increment/decrement, DELETE when count reaches 0).
--    Migration 033 incorrectly set this table to admin-only write, which breaks
--    all reaction functionality on mobile. Replace with member-access (same as
--    message_reactions).
drop policy if exists "message reaction counts manage by admin" on public.message_reaction_counts;

create policy "message reaction counts manage by member"
  on public.message_reaction_counts
  for all
  using (public.can_access_message(message_id))
  with check (public.can_access_message(message_id));

-- 3. student_access_codes: migration 033's dynamic DROP removed the admin-only
--    policies that migration 020 created. Migration 033 did not recreate them.
--    Restore the original admin-only intent.
create policy "student access codes read by admin"
  on public.student_access_codes
  for select
  using (public.is_org_admin(org_id));

create policy "student access codes manage by admin"
  on public.student_access_codes
  for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));
