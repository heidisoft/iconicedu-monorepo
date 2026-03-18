-- Allow self-service persona profile creation while keeping admin insert access.
-- This policy is intentionally strict: account ownership + org match + allowed kind +
-- matching role (or org admin).

drop policy if exists "profiles insert self with role" on public.profiles;

create policy "profiles insert self with role"
  on public.profiles
  for insert
  with check (
    -- Never allow creating system profiles from user-scoped sessions.
    kind in (
      'educator'::public.profile_kind,
      'guardian'::public.profile_kind,
      'child'::public.profile_kind,
      'staff'::public.profile_kind
    )
    and exists (
      select 1
      from public.accounts a
      where a.id = profiles.account_id
        and a.org_id = profiles.org_id
        and a.auth_user_id = auth.uid()
        and a.deleted_at is null
    )
    and (
      public.is_org_admin(profiles.org_id)
      or exists (
        select 1
        from public.user_roles ur
        where ur.org_id = profiles.org_id
          and ur.account_id = profiles.account_id
          and ur.deleted_at is null
          and (
            (profiles.kind = 'educator'::public.profile_kind and ur.role_key = 'educator'::public.role_key)
            or (profiles.kind = 'guardian'::public.profile_kind and ur.role_key = 'guardian'::public.role_key)
            or (profiles.kind = 'child'::public.profile_kind and ur.role_key = 'child'::public.role_key)
            or (profiles.kind = 'staff'::public.profile_kind and ur.role_key = 'staff'::public.role_key)
          )
      )
    )
  );
