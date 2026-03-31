set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.can_self_join_channel(_org_id uuid, _channel_id uuid, _profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_profile_owner(_profile_id)
    and exists (
      select 1
      from public.profiles p
      where p.id = _profile_id
        and p.org_id = _org_id
        and p.deleted_at is null
    )
    and exists (
      select 1
      from public.channels c
      where c.id = _channel_id
        and c.org_id = _org_id
        and c.kind = 'channel'
        and c.purpose <> 'support'
        and c.visibility = 'public'
        and c.status = 'active'
        and c.archived_at is null
        and c.deleted_at is null
    );
$function$
;


  create policy "channel members insert self join public channel"
  on "public"."channel_members"
  as permissive
  for insert
  to public
with check (((deleted_at IS NULL) AND public.can_self_join_channel(org_id, channel_id, profile_id)));



  create policy "channel members update self join public channel"
  on "public"."channel_members"
  as permissive
  for update
  to public
using (public.can_self_join_channel(org_id, channel_id, profile_id))
with check (((deleted_at IS NULL) AND public.can_self_join_channel(org_id, channel_id, profile_id)));


