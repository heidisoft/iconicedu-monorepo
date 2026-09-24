-- mark_channel_unread is security definer and performs no caller or
-- membership checks of its own — it trusts every id it's given. Granting it
-- to `authenticated` let any signed-in Supabase client call it directly with
-- an arbitrary org/channel/account/actor id, bypassing apps/api's membership
-- check entirely (PR #267 review). apps/api is the only caller and always
-- invokes it with the service-role client, so restrict execution to
-- `service_role`.
revoke execute on function public.mark_channel_unread(
  uuid,
  uuid,
  uuid,
  uuid
) from authenticated;
