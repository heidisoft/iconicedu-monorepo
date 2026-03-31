select id, account_id, org_id, kind, display_name
from public.profiles
where id = '31e0ac04-7de8-470b-8025-9f4c95913330'::uuid;

select id, auth_user_id, org_id, active_profile_id
from public.accounts
where id = public.current_account_id();
