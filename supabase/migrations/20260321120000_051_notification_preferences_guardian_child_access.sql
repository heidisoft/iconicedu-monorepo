-- Allow linked guardians to read/write child notification settings during view-as-child.
-- Keeps existing self access and org admin access.

drop policy if exists "notification preferences all self" on public.notification_preferences;
drop policy if exists "notification preferences self" on public.notification_preferences;

create policy "notification preferences all self guardian or admin"
  on public.notification_preferences for all
  using (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
      or exists (
        select 1
        from public.profiles cp
        join public.family_links fl
          on fl.child_account_id = cp.account_id
         and fl.deleted_at is null
        where cp.id = notification_preferences.profile_id
          and cp.org_id = notification_preferences.org_id
          and cp.deleted_at is null
          and fl.guardian_account_id = public.current_account_id()
      )
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
      or exists (
        select 1
        from public.profiles cp
        join public.family_links fl
          on fl.child_account_id = cp.account_id
         and fl.deleted_at is null
        where cp.id = notification_preferences.profile_id
          and cp.org_id = notification_preferences.org_id
          and cp.deleted_at is null
          and fl.guardian_account_id = public.current_account_id()
      )
    )
  );

drop policy if exists "notification preference scopes all self"
  on public.notification_preference_scopes;
drop policy if exists "notification preference scopes self"
  on public.notification_preference_scopes;

create policy "notification preference scopes all self guardian or admin"
  on public.notification_preference_scopes for all
  using (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
      or exists (
        select 1
        from public.profiles cp
        join public.family_links fl
          on fl.child_account_id = cp.account_id
         and fl.deleted_at is null
        where cp.id = notification_preference_scopes.profile_id
          and cp.org_id = notification_preference_scopes.org_id
          and cp.deleted_at is null
          and fl.guardian_account_id = public.current_account_id()
      )
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_profile_owner(profile_id)
      or public.is_org_admin(org_id)
      or exists (
        select 1
        from public.profiles cp
        join public.family_links fl
          on fl.child_account_id = cp.account_id
         and fl.deleted_at is null
        where cp.id = notification_preference_scopes.profile_id
          and cp.org_id = notification_preference_scopes.org_id
          and cp.deleted_at is null
          and fl.guardian_account_id = public.current_account_id()
      )
    )
  );
