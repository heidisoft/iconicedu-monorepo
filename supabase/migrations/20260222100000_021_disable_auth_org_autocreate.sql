-- Disable legacy auth trigger that auto-creates the default org.
-- Org creation must happen only via explicit admin action (/api/orgs/bootstrap).

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_auth_user_verified();
drop function if exists public.handle_new_auth_user();

-- Remove legacy seeded org only when it has no active accounts.
delete from public.orgs o
where o.id = 'b3a5f6e3-2f6a-4c12-9d3a-1f1f1b0a6f1a'
  and not exists (
    select 1
    from public.accounts a
    where a.org_id = o.id
      and a.deleted_at is null
  );
