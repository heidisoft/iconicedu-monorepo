-- Profile presentation preferences and append-only, transaction-coupled history.
alter table public.profiles add column hide_role boolean not null default false;
alter table public.profiles add column hide_status boolean not null default false;

create table public.profile_change_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  actor_account_id uuid,
  entity_table text not null,
  entity_id uuid not null,
  operation text not null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);
create index profile_change_events_org_time on public.profile_change_events(org_id, occurred_at);
alter table public.profile_change_events enable row level security;
create policy "profile history admin read" on public.profile_change_events for select to authenticated
using (public.is_org_admin(org_id));
revoke all on public.profile_change_events from anon, authenticated;
grant select on public.profile_change_events to authenticated;

create function public.record_profile_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare previous jsonb; current_data jsonb; row_data jsonb; actor uuid;
begin
  if TG_OP <> 'INSERT' then previous := to_jsonb(old); end if;
  if TG_OP <> 'DELETE' then current_data := to_jsonb(new); end if;
  if previous is not distinct from current_data then return new; end if;
  row_data := coalesce(current_data, previous);
  actor := public.current_account_id();
  if actor is null and auth.role() = 'service_role' then
    actor := coalesce(nullif(current_setting('app.profile_actor_account_id', true), '')::uuid, (row_data->>'updated_by')::uuid, case when TG_OP = 'INSERT' then (row_data->>'created_by')::uuid end);
  end if;
  insert into public.profile_change_events(org_id, actor_account_id, entity_table, entity_id, operation, before_data, after_data)
  values ((row_data->>'org_id')::uuid, actor, TG_TABLE_NAME,
    coalesce((row_data->>'id')::uuid, (row_data->>'profile_id')::uuid), TG_OP, previous, current_data);
  return coalesce(new, old);
end $$;
create trigger profile_change_history after insert or update or delete on public.profiles for each row execute function public.record_profile_change();
create trigger child_detail_change_history after insert or update or delete on public.child_profiles for each row execute function public.record_profile_change();
create trigger child_grade_change_history after insert or update or delete on public.child_profile_grade_level for each row execute function public.record_profile_change();
create trigger family_link_change_history after insert or update or delete on public.family_links for each row execute function public.record_profile_change();

-- NULL scopes mean the existing full guardian access. Explicit scopes fail closed.
create function public.can_edit_family_profile_as(target_id uuid, actor_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.accounts a on a.id = p.account_id
    where p.id = target_id and p.deleted_at is null and a.deleted_at is null
    and exists (select 1 from public.accounts actor where actor.id = actor_id and actor.org_id = p.org_id and actor.deleted_at is null)
    and (a.id = actor_id or (p.kind = 'child' and exists (
      select 1 from public.family_links fl join public.accounts guardian on guardian.id = fl.guardian_account_id
      where fl.child_account_id = p.account_id and fl.org_id = p.org_id and fl.deleted_at is null
      and guardian.id = actor_id and guardian.deleted_at is null
      and (fl.permissions_scope is null or 'edit_profile' = any(fl.permissions_scope) or 'manage_children' = any(fl.permissions_scope))
    )))
  );
$$;

-- Authenticated callers can ask only about their own access. The actor-specific
-- helper is private to privileged code and security-definer wrappers.
revoke all on function public.can_edit_family_profile_as(uuid,uuid) from public, anon, authenticated;
grant execute on function public.can_edit_family_profile_as(uuid,uuid) to service_role;
create function public.can_edit_family_profile(target_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_edit_family_profile_as(target_id, public.current_account_id());
$$;

create function public.get_profile_settings(target_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = target_id and deleted_at is null;
  if not found or not public.is_org_member(p.org_id) or not (
    p.account_id = public.current_account_id() or exists (
      select 1 from public.family_links fl where fl.child_account_id = p.account_id
      and fl.guardian_account_id = public.current_account_id() and fl.org_id = p.org_id and fl.deleted_at is null
    )
  ) then raise exception 'Access denied' using errcode = '42501'; end if;
  return jsonb_build_object(
    'profile', to_jsonb(p),
    'canEdit', public.can_edit_family_profile(target_id),
    'childDetails', (select to_jsonb(c) from public.child_profiles c where c.profile_id = p.id and c.deleted_at is null),
    'gradeLevel', (select g.grade_id from public.child_profile_grade_level g where g.profile_id = p.id and g.deleted_at is null limit 1),
    'canRemove', p.kind = 'child' and exists (
      select 1 from public.family_links fl where fl.child_account_id = p.account_id
      and fl.org_id = p.org_id and fl.guardian_account_id = public.current_account_id()
      and fl.deleted_at is null and (fl.permissions_scope is null or 'manage_children' = any(fl.permissions_scope))
    ),
    'removalBlocked',
      exists (select 1 from public.class_schedule_participants where profile_id = p.id and deleted_at is null)
      or exists (select 1 from public.learning_space_participants where profile_id = p.id and deleted_at is null)
      or exists (select 1 from public.family_links where child_account_id = p.account_id and org_id = p.org_id and guardian_account_id <> public.current_account_id() and deleted_at is null)
  );
end $$;

create function public.save_profile_settings(target_id uuid, changes jsonb, actor_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = target_id for update;
  if not public.can_edit_family_profile_as(target_id, actor_id) then raise exception 'Access denied' using errcode = '42501'; end if;
  -- Existing audit stamp triggers reset updated_by for service sessions. Carry the
  -- API-verified actor in transaction-local context for the history trigger.
  perform set_config('app.profile_actor_account_id', actor_id::text, true);
  -- Only this fixed presentation allowlist can be written. No role/status/account changes.
  update public.profiles set
    first_name = changes->>'first_name', last_name = changes->>'last_name', display_name = changes->>'display_name',
    ui_theme_key = changes->>'ui_theme_key', timezone = changes->>'timezone', locale = changes->>'locale',
    hide_role = (changes->>'hide_role')::boolean, hide_status = (changes->>'hide_status')::boolean,
    city = case when changes ? 'city' then changes->>'city' else p.city end,
    region = case when changes ? 'region' then changes->>'region' else p.region end,
    postal_code = case when changes ? 'postal_code' then changes->>'postal_code' else p.postal_code end,
    country_code = case when changes ? 'country_code' then changes->>'country_code' else p.country_code end,
    country_name = case when changes ? 'country_name' then changes->>'country_name' else p.country_name end,
    avatar_url = coalesce(changes->>'avatar_url', p.avatar_url),
    avatar_source = coalesce((changes->>'avatar_source')::public.avatar_source, p.avatar_source),
    avatar_updated_at = case when changes ? 'avatar_url' then now() else p.avatar_updated_at end,
    updated_at = now(), updated_by = actor_id
  where id = target_id returning * into p;
  if changes ? 'birth_year' or changes ? 'grade_level' then
    if p.kind <> 'child' then raise exception 'Not a child profile' using errcode = '42501'; end if;
    if changes ? 'birth_year' then
      update public.child_profiles set birth_year = (changes->>'birth_year')::integer, updated_at = now(), updated_by = actor_id where profile_id = target_id;
    end if;
    if changes ? 'grade_level' then
      delete from public.child_profile_grade_level where profile_id = target_id;
      insert into public.child_profile_grade_level(org_id, profile_id, grade_id, grade_label, created_by, updated_by)
      values (p.org_id, target_id, changes->>'grade_level', changes->>'grade_level', actor_id, actor_id);
    end if;
  end if;
  return to_jsonb(p);
end $$;
-- Only the API may submit validated changes with the verified actor identity.
revoke all on function public.save_profile_settings(uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_profile_settings(uuid,jsonb,uuid) to service_role;

create function public.remove_family_child(target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; actor uuid := public.current_account_id();
begin
  select * into p from public.profiles where id = target_id and deleted_at is null for update;
  if not found or p.kind <> 'child' or p.account_id = actor or not public.can_edit_family_profile(target_id)
    or not exists (select 1 from public.family_links where child_account_id = p.account_id and guardian_account_id = actor and org_id = p.org_id and deleted_at is null and (permissions_scope is null or 'manage_children' = any(permissions_scope)))
  then raise exception 'Access denied' using errcode = '42501'; end if;
  if exists (select 1 from public.class_schedule_participants where profile_id = target_id and deleted_at is null)
    or exists (select 1 from public.learning_space_participants where profile_id = target_id and deleted_at is null)
    or exists (select 1 from public.family_links where child_account_id = p.account_id and org_id = p.org_id and guardian_account_id <> actor and deleted_at is null)
  then raise exception 'Contact support: child has class assignments or another guardian' using errcode = '23503'; end if;
  update public.profiles set deleted_at = now(), deleted_by = actor, updated_at = now(), updated_by = actor where id = target_id;
  update public.family_links set deleted_at = now(), deleted_by = actor, updated_at = now(), updated_by = actor
    where child_account_id = p.account_id and org_id = p.org_id and deleted_at is null;
end $$;

-- Serialize assignments with removal so a concurrent enrollment cannot bypass the check.
create function public.require_active_assignment_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.profile_id is not null and new.deleted_at is null then
    perform 1 from public.profiles where id = new.profile_id and org_id = new.org_id and deleted_at is null for share;
    if not found then raise exception 'Profile is unavailable' using errcode = '23503'; end if;
  end if;
  return new;
end $$;
create trigger schedule_active_profile before insert or update on public.class_schedule_participants for each row execute function public.require_active_assignment_profile();
create trigger learning_space_active_profile before insert or update on public.learning_space_participants for each row execute function public.require_active_assignment_profile();

revoke all on function public.record_profile_change(), public.require_active_assignment_profile() from public;
revoke all on function public.can_edit_family_profile(uuid), public.get_profile_settings(uuid), public.remove_family_child(uuid) from public, anon;
grant execute on function public.can_edit_family_profile(uuid), public.get_profile_settings(uuid), public.remove_family_child(uuid) to authenticated;

-- New photos are immutable objects; replacements use a new filename.
create policy "avatars guardian insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'public-avatars' and public.can_edit_family_profile(public.storage_avatar_profile_id(name))
  and exists (select 1 from public.profiles p where p.id = public.storage_avatar_profile_id(name) and p.org_id = public.storage_avatar_org_id(name))
);
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'public-avatars';
