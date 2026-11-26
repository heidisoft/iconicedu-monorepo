-- Preserve every field outside the explicitly edited profile section.
create or replace function public.save_profile_settings(target_id uuid, changes jsonb, actor_id uuid) returns jsonb
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
    first_name = case when changes ? 'first_name' then changes->>'first_name' else p.first_name end, last_name = case when changes ? 'last_name' then changes->>'last_name' else p.last_name end, display_name = case when changes ? 'display_name' then changes->>'display_name' else p.display_name end,
    ui_theme_key = case when changes ? 'ui_theme_key' then changes->>'ui_theme_key' else p.ui_theme_key end, timezone = case when changes ? 'timezone' then changes->>'timezone' else p.timezone end, locale = case when changes ? 'locale' then changes->>'locale' else p.locale end,
    hide_role = case when changes ? 'hide_role' then (changes->>'hide_role')::boolean else p.hide_role end, hide_status = case when changes ? 'hide_status' then (changes->>'hide_status')::boolean else p.hide_status end,
    city = case when changes ? 'city' then changes->>'city' else p.city end,
    region = case when changes ? 'region' then changes->>'region' else p.region end,
    postal_code = case when changes ? 'postal_code' then changes->>'postal_code' else p.postal_code end,
    country_code = case when changes ? 'country_code' then changes->>'country_code' else p.country_code end,
    country_name = case when changes ? 'country_name' then changes->>'country_name' else p.country_name end,
    languages_spoken = case when changes ? 'languages_spoken' then array(select jsonb_array_elements_text(changes->'languages_spoken')) else p.languages_spoken end,
    bio = case when changes ? 'bio' then changes->>'bio' else p.bio end,
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
