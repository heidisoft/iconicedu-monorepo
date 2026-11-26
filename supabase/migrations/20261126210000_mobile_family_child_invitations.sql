-- Use the same invitation records and verified-email web acceptance flow on mobile.
create trigger family_invite_change_history after insert or update or delete on public.family_link_invites
for each row execute function public.record_profile_change();

create function public.prepare_family_child_invite(actor_id uuid, invited_email_input text, target_profile_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor public.accounts; child_account public.accounts; child_profile public.profiles;
  family_id_value uuid; invite public.family_link_invites; profile_created boolean := false;
  email_value text := lower(btrim(invited_email_input)); slug_value text;
begin
  select * into actor from public.accounts where id = actor_id and deleted_at is null for update;
  if not found or actor.status::text in ('inactive','deleted','suspended','blocked') or not (actor.primary_role = 'guardian' or exists (
    select 1 from public.profiles where account_id = actor.id and org_id = actor.org_id and kind = 'guardian' and deleted_at is null
  )) then raise exception 'Guardian access required' using errcode = '42501'; end if;
  if email_value is null or length(email_value) > 254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or email_value = lower(actor.email) then raise exception 'Invalid child email' using errcode = '22023'; end if;
  if (select count(*) from public.family_link_invites where created_by_account_id = actor.id and created_at > now() - interval '1 hour') >= 10
    then raise exception 'Invitation limit reached' using errcode = 'P0429'; end if;
  if exists (select 1 from public.family_link_invites where org_id = actor.org_id and created_by_account_id = actor.id
    and invited_role = 'child' and lower(invited_email) = email_value and status = 'pending' and deleted_at is null and expires_at > now())
    then raise exception 'Invitation already pending' using errcode = '23505'; end if;
  perform set_config('app.profile_actor_account_id', actor.id::text, true);
  select slug into slug_value from public.orgs where id = actor.org_id;
  if slug_value is null then raise exception 'Organization unavailable' using errcode = '42501'; end if;

  if target_profile_id is not null then
    select * into child_profile from public.profiles where id = target_profile_id and org_id = actor.org_id and kind = 'child' and deleted_at is null for update;
    if not found or not exists (select 1 from public.family_links fl where fl.org_id = actor.org_id
      and fl.guardian_account_id = actor.id and fl.child_account_id = child_profile.account_id and fl.deleted_at is null
      and (fl.permissions_scope is null or 'manage_children' = any(fl.permissions_scope)))
      then raise exception 'Child access denied' using errcode = '42501'; end if;
    select * into child_account from public.accounts where id = child_profile.account_id and org_id = actor.org_id and deleted_at is null for update;
    if not found or child_account.auth_user_id is not null or (child_account.email is not null and lower(child_account.email) <> email_value)
      then raise exception 'Child already has sign-in details' using errcode = '23505'; end if;
    if exists (select 1 from public.accounts where org_id = actor.org_id and lower(email) = email_value and id <> child_account.id and deleted_at is null)
      then raise exception 'Email already belongs to another account' using errcode = '23505'; end if;
    -- Assign email only to an authorized, managed child; preserve profile names and status.
    update public.accounts set email = email_value, updated_by = actor.id, updated_at = now() where id = child_account.id returning * into child_account;
  else
    select * into child_account from public.accounts where org_id = actor.org_id and lower(email) = email_value and deleted_at is null for update;
    if found then
      select * into child_profile from public.profiles where account_id = child_account.id and org_id = actor.org_id and kind = 'child' and deleted_at is null limit 1;
      if not found or exists (select 1 from public.family_links fl where fl.child_account_id = child_account.id and fl.guardian_account_id = actor.id and fl.org_id = actor.org_id and fl.deleted_at is null and fl.permissions_scope is not null and not ('manage_children' = any(fl.permissions_scope))) or exists (select 1 from public.profiles where account_id = child_account.id and kind <> 'child' and deleted_at is null)
        then raise exception 'Invitation not allowed' using errcode = '42501'; end if;
    else
      insert into public.accounts(org_id, email, status, created_by, updated_by)
        values (actor.org_id, email_value, 'invited', actor.id, actor.id) returning * into child_account;
      insert into public.profiles(org_id, account_id, kind, display_name, avatar_source, avatar_seed, timezone, locale, status, ui_theme_key, created_by, updated_by)
        values (actor.org_id, child_account.id, 'child', 'Invited child', 'seed', child_account.id::text, 'UTC', 'en-US', 'invited', 'teal', actor.id, actor.id) returning * into child_profile;
      profile_created := true;
      insert into public.child_profiles(org_id, profile_id, created_by, updated_by) values (actor.org_id, child_profile.id, actor.id, actor.id);
    end if;
  end if;

  select fl.family_id into family_id_value from public.family_links fl where fl.org_id = actor.org_id and fl.guardian_account_id = actor.id and fl.deleted_at is null limit 1;
  if family_id_value is null then
    select id into family_id_value from public.families where org_id = actor.org_id and created_by = actor.id and deleted_at is null limit 1;
  end if;
  if family_id_value is null then
    insert into public.families(org_id, display_name, created_by, updated_by) values (actor.org_id, 'Family', actor.id, actor.id) returning id into family_id_value;
  end if;
  insert into public.family_link_invites(org_id, family_id, invited_role, invited_email, invite_code_hash, created_by_account_id, status, expires_at, max_uses, uses, created_by, updated_by)
    values (actor.org_id, family_id_value, 'child', email_value, encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), actor.id, 'pending', now() + interval '7 days', 1, 0, actor.id, actor.id) returning * into invite;
  return jsonb_build_object('invite', to_jsonb(invite), 'orgSlug', slug_value, 'profileId', child_profile.id, 'hasAuthAccount', child_account.auth_user_id is not null, 'profileCreated', profile_created, 'seedDefaults', profile_created or (child_profile.created_by = actor.id and child_profile.status::text = 'invited'));
end $$;
revoke all on function public.prepare_family_child_invite(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.prepare_family_child_invite(uuid,text,uuid) to service_role;

create function public.revoke_family_child_invite(actor_id uuid, invite_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.profile_actor_account_id', actor_id::text, true);
  update public.family_link_invites i set status = 'revoked', updated_by = actor_id, updated_at = now()
  where i.id = invite_id and i.created_by_account_id = actor_id and i.status = 'pending' and i.deleted_at is null
    and exists (select 1 from public.accounts a where a.id = actor_id and a.org_id = i.org_id and a.deleted_at is null);
  if not found then raise exception 'Invitation unavailable' using errcode = '42501'; end if;
end $$;
revoke all on function public.revoke_family_child_invite(uuid,uuid) from public, anon, authenticated;
grant execute on function public.revoke_family_child_invite(uuid,uuid) to service_role;

create or replace function public.get_profile_settings(target_id uuid) returns jsonb
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
    'childAccount', case when p.kind = 'child' then (select jsonb_build_object('email', a.email, 'hasAuthAccount', a.auth_user_id is not null) from public.accounts a where a.id = p.account_id and a.org_id = p.org_id and a.deleted_at is null) end,
    'canEdit', public.can_edit_family_profile(target_id),
    'childDetails', (select to_jsonb(c) from public.child_profiles c where c.profile_id = p.id and c.deleted_at is null),
    'gradeLevel', (select g.grade_id from public.child_profile_grade_level g where g.profile_id = p.id and g.deleted_at is null limit 1),
    'canInvite', p.kind = 'child' and exists (select 1 from public.family_links fl where fl.child_account_id = p.account_id and fl.org_id = p.org_id and fl.guardian_account_id = public.current_account_id() and fl.deleted_at is null and (fl.permissions_scope is null or 'manage_children' = any(fl.permissions_scope))),
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


-- Child invitations are accepted through the existing web callback. Enforce expiry,
-- verified recipient identity and the family link in the same database transaction.
create function public.validate_child_invitation_acceptance() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.invited_role = 'child' and old.status = 'pending' and new.status = 'accepted' then
    if new.org_id <> old.org_id or new.family_id <> old.family_id or new.created_by_account_id <> old.created_by_account_id or new.invited_role <> old.invited_role or new.invited_email is distinct from old.invited_email or new.invited_phone_e164 is distinct from old.invited_phone_e164 then raise exception 'Invitation identity is immutable during acceptance' using errcode = '42501'; end if;
    if old.expires_at <= now() or old.uses >= old.max_uses then
      raise exception 'Invitation expired or already used' using errcode = '22023';
    end if;
    if new.accepted_by_account_id is null or not exists (
      select 1 from public.accounts a join auth.users u on u.id = a.auth_user_id
      where a.id = new.accepted_by_account_id and a.org_id = old.org_id and a.deleted_at is null
      and ((old.invited_email is not null and lower(u.email) = lower(old.invited_email) and u.email_confirmed_at is not null)
        or (old.invited_phone_e164 is not null and u.phone = old.invited_phone_e164 and u.phone_confirmed_at is not null))
    ) or not exists (select 1 from public.profiles where account_id = new.accepted_by_account_id and org_id = old.org_id and kind = 'child' and deleted_at is null)
      then raise exception 'Verified child recipient required' using errcode = '42501'; end if;
    -- Serialize acceptance with child removal so a link cannot revive a removed profile.
    perform 1 from public.profiles where account_id = new.accepted_by_account_id and org_id = old.org_id and kind = 'child' and deleted_at is null for share;
    if not found then raise exception 'Child profile unavailable' using errcode = '42501'; end if;
    if not exists (select 1 from public.accounts where id = old.created_by_account_id and org_id = old.org_id and deleted_at is null and coalesce(status::text, 'active') not in ('inactive','deleted','suspended','blocked'))
      or not exists (select 1 from public.families where id = old.family_id and org_id = old.org_id and deleted_at is null)
      then raise exception 'Family unavailable' using errcode = '42501'; end if;
    new.uses := old.uses + 1;
    new.accepted_at := now();
    if auth.role() = 'service_role' then perform set_config('app.profile_actor_account_id', new.accepted_by_account_id::text, true); end if;
  end if;
  return new;
end $$;
create trigger validate_child_invitation_acceptance before update on public.family_link_invites
for each row execute function public.validate_child_invitation_acceptance();

create function public.link_accepted_child_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.invited_role = 'child' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.family_links(org_id, family_id, guardian_account_id, child_account_id, relation, created_by, updated_by)
      values (new.org_id, new.family_id, new.created_by_account_id, new.accepted_by_account_id, 'guardian', new.accepted_by_account_id, new.accepted_by_account_id)
      on conflict (org_id,family_id,guardian_account_id,child_account_id) do update set deleted_at = null, deleted_by = null, updated_at = now();
  end if;
  return new;
end $$;
create trigger link_accepted_child_invitation after update on public.family_link_invites
for each row execute function public.link_accepted_child_invitation();
revoke all on function public.validate_child_invitation_acceptance(), public.link_accepted_child_invitation() from public, anon, authenticated;

-- Account email assignment belongs to the same auditable child-invitation operation.
create trigger account_contact_change_history after insert or update of email on public.accounts
for each row execute function public.record_profile_change();
