-- supabase-access-control-baseline
--
-- Keep public-schema table access aligned with the API-first architecture:
-- unauthenticated callers use apps/api for public flows, and new tables are
-- unreachable through the Data API until a forward migration explicitly grants
-- the minimum role privileges after enabling and reviewing RLS.

-- ---------------------------------------------------------------------------
-- Existing objects
-- ---------------------------------------------------------------------------

-- Public product flows (including public assessments) are served by apps/api.
-- The anon role therefore needs no direct table or sequence access in `public`.
-- ALL also removes TRUNCATE, REFERENCES, TRIGGER, sequence UPDATE, and any
-- version-specific privileges inherited from the Supabase image defaults.
revoke all privileges on all tables in schema public from public, anon;
revoke all privileges on all sequences in schema public from public, anon;

-- Existing authenticated Data API callers retain ordinary row DML, which is
-- still constrained by RLS, but do not need schema-management or bulk-table
-- privileges such as TRUNCATE. Rebuilding the ACL makes that boundary explicit.
revoke all privileges on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all privileges on all sequences in schema public from authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- These assessment relationship tables are also API-owned. Removing direct
-- authenticated access closes the cross-tenant policies introduced by the
-- assessment migration while preserving service-role access for apps/api.
revoke select, insert, update, delete on table
  public.assessment_skill_prerequisites,
  public.assessment_test_sections,
  public.assessment_test_section_items,
  public.assessment_test_skill_pools,
  public.assessment_delivery_participants
from authenticated;

drop policy if exists "skill_prerequisites_read"
  on public.assessment_skill_prerequisites;
drop policy if exists "test_sections_read"
  on public.assessment_test_sections;
drop policy if exists "test_section_items_read"
  on public.assessment_test_section_items;
drop policy if exists "test_skill_pools_read"
  on public.assessment_test_skill_pools;
drop policy if exists "delivery_participants_read"
  on public.assessment_delivery_participants;

-- A row containing a non-null token does not prove that the caller possesses
-- that token. Token lookup stays in the public apps/api endpoint, which compares
-- the caller-provided token before returning a delivery.
drop policy if exists "deliveries_read_public"
  on public.assessment_deliveries;
alter policy "deliveries_read_org"
  on public.assessment_deliveries
  to authenticated;

-- ---------------------------------------------------------------------------
-- Future objects
-- ---------------------------------------------------------------------------

-- Remove both global and public-schema defaults. Per-schema defaults are added
-- to global defaults in PostgreSQL, so both scopes must be revoked to guarantee
-- that future postgres-created objects fail closed.
alter default privileges for role postgres
  revoke all privileges on tables
  from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on tables
  from public, anon, authenticated;

alter default privileges for role postgres
  revoke all privileges on sequences
  from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deployment assertions
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('PUBLIC', 'anon')
  ) then
    raise exception 'anon still has direct table privileges in the public schema';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(c.relacl, pg_catalog.acldefault('S', c.relowner))
    ) acl
    left join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee
    where n.nspname = 'public'
      and c.relkind = 'S'
      and (acl.grantee = 0 or grantee_role.rolname = 'anon')
  ) then
    raise exception 'anon still has direct sequence privileges in the public schema';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'authenticated has non-DML table privileges in the public schema';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and table_name in (
        'assessment_skill_prerequisites',
        'assessment_test_sections',
        'assessment_test_section_items',
        'assessment_test_skill_pools',
        'assessment_delivery_participants'
      )
  ) then
    raise exception 'authenticated still has direct access to API-owned assessment tables';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ) then
    raise exception 'a public table is missing row level security';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_default_acl d
    left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral pg_catalog.aclexplode(d.defaclacl) acl
    join pg_catalog.pg_roles owner_role on owner_role.oid = d.defaclrole
    left join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee
    where owner_role.rolname = 'postgres'
      and (
        acl.grantee = 0
        or grantee_role.rolname in ('anon', 'authenticated')
      )
      and d.defaclobjtype in ('r', 'S')
      and (d.defaclnamespace = 0 or n.nspname = 'public')
  ) then
    raise exception 'postgres default privileges still expose future tables or sequences';
  end if;
end
$$;

notify pgrst, 'reload schema';
