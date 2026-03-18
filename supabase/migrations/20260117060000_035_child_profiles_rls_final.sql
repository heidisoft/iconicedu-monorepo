-- Recreate child profile RLS rules, combining owner, guardian, child, and admin paths.
-- NOTE: drop read policy first so mixed branch history / replayed migrations stay idempotent.
drop policy if exists "child profiles read by org" on public.child_profiles;
drop policy if exists "child profiles manage by admin" on public.child_profiles;
drop policy if exists "child profiles insert guardian" on public.child_profiles;
drop policy if exists "child profiles insert by owner or guardian" on public.child_profiles;
drop policy if exists "child profiles update by guardian or owner" on public.child_profiles;
drop policy if exists "child profiles delete by owner or guardian" on public.child_profiles;
drop policy if exists "child profiles insert by child" on public.child_profiles;
drop policy if exists "child profiles update by child" on public.child_profiles;
drop policy if exists "child profiles delete by child" on public.child_profiles;

create policy "child profiles read by org"
  on public.child_profiles
  for select
  using (deleted_at is null and public.is_org_member(org_id));

create policy "child profiles manage by admin"
  on public.child_profiles
  for all
  using (deleted_at is null and public.is_org_admin(org_id))
  with check (deleted_at is null and public.is_org_admin(org_id));

create policy "child profiles insert by guardian"
  on public.child_profiles
  for insert
  with check (
    deleted_at is null
    and exists (
      select 1
      from public.family_links fl
      where fl.guardian_account_id = public.current_account_id()
        and fl.org_id = child_profiles.org_id
        and fl.deleted_at is null
    )
  );

create policy "child profiles insert by owner or guardian"
  on public.child_profiles
  for insert
  with check (
    deleted_at is null
    and (
      public.is_profile_owner(child_profiles.profile_id)
      or exists (
        select 1
        from public.family_links fl
        where fl.guardian_account_id = public.current_account_id()
          and fl.org_id = child_profiles.org_id
          and fl.child_account_id = (
            select account_id
            from public.profiles p
            where p.id = child_profiles.profile_id
          )
          and fl.deleted_at is null
      )
    )
  );

create policy "child profiles update by guardian or owner"
  on public.child_profiles
  for update
  using (
    deleted_at is null
    and (
      public.is_profile_owner(child_profiles.profile_id)
      or exists (
        select 1
        from public.family_links fl
        join public.accounts child_account on child_account.id = fl.child_account_id
        where fl.guardian_account_id = public.current_account_id()
          and child_account.id = (
            select account_id
            from public.profiles p
            where p.id = child_profiles.profile_id
          )
          and fl.org_id = child_profiles.org_id
          and fl.deleted_at is null
          and child_account.deleted_at is null
      )
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_profile_owner(child_profiles.profile_id)
      or exists (
        select 1
        from public.family_links fl
        join public.accounts child_account on child_account.id = fl.child_account_id
        where fl.guardian_account_id = public.current_account_id()
          and child_account.id = (
            select account_id
            from public.profiles p
            where p.id = child_profiles.profile_id
          )
          and fl.org_id = child_profiles.org_id
          and fl.deleted_at is null
          and child_account.deleted_at is null
      )
    )
  );

create policy "child profiles delete by owner or guardian"
  on public.child_profiles
  for delete
  using (
    deleted_at is null
    and (
      public.is_profile_owner(child_profiles.profile_id)
      or exists (
        select 1
        from public.family_links fl
        join public.accounts child_account on child_account.id = fl.child_account_id
        where fl.guardian_account_id = public.current_account_id()
          and child_account.id = (
            select account_id
            from public.profiles p
            where p.id = child_profiles.profile_id
          )
          and fl.org_id = child_profiles.org_id
          and fl.deleted_at is null
          and child_account.deleted_at is null
      )
    )
  );

create policy "child profiles insert by child"
  on public.child_profiles
  for insert
  with check (
    deleted_at is null
    and public.is_profile_owner(child_profiles.profile_id)
  );

create policy "child profiles update by child"
  on public.child_profiles
  for update
  using (
    deleted_at is null
    and public.is_profile_owner(child_profiles.profile_id)
  )
  with check (
    deleted_at is null
    and public.is_profile_owner(child_profiles.profile_id)
  );

create policy "child profiles delete by child"
  on public.child_profiles
  for delete
  using (
    deleted_at is null
    and public.is_profile_owner(child_profiles.profile_id)
  );
