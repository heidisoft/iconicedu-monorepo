-- Restore the standard Supabase API-role grants on the public schema.
--
-- Why this is needed
-- ------------------
-- PostgREST connects as anon, authenticated, or service_role. Every request is
-- checked against two independent layers: table privileges (GRANT) first, then
-- row level security. A missing GRANT fails with 42501 before any policy runs.
--
-- No migration in this repository has ever issued a table-level GRANT. Until
-- now that was unnecessary: the Supabase Postgres image carried a default
-- privilege rule giving postgres-created tables in `public` full DML access for
-- the three API roles, so every `create table` inherited it automatically.
--
-- Newer Supabase Postgres images (observed on 17.6.1.159) narrowed that rule to
-- TRUNCATE, REFERENCES, TRIGGER and MAINTAIN — no SELECT, INSERT, UPDATE or
-- DELETE. Default privileges are evaluated once, at table-creation time, and
-- baked into each table's ACL, so databases provisioned under the old image keep
-- working forever while any newly created database loses all API access. A fresh
-- `supabase db reset` on a current CLI produces a schema PostgREST cannot read.
--
-- Safety
-- ------
-- Row level security is enabled on every table in `public` and the policy set is
-- defined in 20260309180000_033_rls_full_reset.sql and its successors. Grants are
-- the coarse layer; RLS remains the gate that decides which rows each role sees.
-- Restoring these grants returns the database to the state the existing policies
-- were authored against — it does not widen access beyond that design.
--
-- This migration is idempotent and is a no-op on databases that were provisioned
-- under the older image, where these privileges are already present.

-- ---------------------------------------------------------------------------
-- Existing objects
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Future objects
--
-- Migrations are applied as `postgres`, which owns every table in `public`.
-- Without this, the grants above would cover only the tables that exist today
-- and the next `create table` would reintroduce the failure.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;

-- Drop PostgREST's cached schema so the new privileges are visible immediately.
notify pgrst, 'reload schema';
