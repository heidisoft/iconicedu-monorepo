import test from 'node:test';
import assert from 'node:assert/strict';

import { findSupabaseAccessControlViolations } from './check-supabase-access-control.mjs';

const BASELINE_PATH =
  'supabase/migrations/20260820010000_harden_public_api_role_grants.sql';

const BASELINE = `
-- supabase-access-control-baseline
revoke all privileges on all tables in schema public from public, anon;
revoke all privileges on all sequences in schema public from public, anon;
revoke all privileges on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all privileges on all sequences in schema public from authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges for role postgres
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges for role postgres
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated;
drop policy if exists "deliveries_read_public" on public.assessment_deliveries;
`;

test('accepts the least-privilege baseline', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
  });

  assert.deepEqual(violations, []);
});

test('rejects unreviewed anonymous table grants after the baseline', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      grant select on table public.assessment_deliveries to anon;
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.anon-table-grant');
});

test('rejects GRANT ALL to PUBLIC after the baseline', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      grant all on table public.assessment_deliveries to public;
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.anon-table-grant');
});

test('accepts a reviewed anonymous table grant', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_reviewed.sql': `
      -- supabase-anon-access-reviewed: public catalogue rows are intentionally readable
      grant select on table public.public_catalogue to anon;
    `,
  });

  assert.deepEqual(violations, []);
});

test('rejects future automatic Data API grants', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      alter default privileges for role postgres in schema public
        grant select on tables to authenticated;
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.default-data-api-grant');
});

test('requires RLS in the migration that creates a public table', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      create table public.exposed_records (id uuid primary key);
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.table-rls-required');
});

test('accepts a public table that enables RLS immediately', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_safe.sql': `
      create table public.protected_records (id uuid primary key);
      alter table public.protected_records enable row level security;
      create policy "protected records own rows"
        on public.protected_records for select to authenticated
        using (auth.uid() = id);
    `,
  });

  assert.deepEqual(violations, []);
});

test('requires explicit roles on new policies', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      create policy "implicit public policy"
        on public.protected_records for select
        using (auth.uid() = id);
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.policy-explicit-role');
});

test('requires review for every policy targeting an anonymous role', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      create policy "token-like filter"
        on public.assessment_deliveries for select to anon
        using (access_token is not null);
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.anonymous-policy-review');
});

test('requires review for authenticated allow-all policies', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      create policy "cross tenant read"
        on public.assessment_test_sections for select to authenticated
        using (true);
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.broad-allow-all-policy');
});

test('accepts a reviewed authenticated allow-all policy', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_reviewed.sql': `
      -- supabase-broad-policy-reviewed: shared immutable catalogue
      create policy "shared catalogue read"
        on public.shared_catalogue for select to authenticated
        using (true);
    `,
  });

  assert.deepEqual(violations, []);
});

test('requires public views to invoke with caller security', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      create view public.exposed_records as select * from public.protected_records;
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.view-security-invoker');
});

test('allows private-schema views without a public security-invoker requirement', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_private.sql': `
      create view internal.reporting_records as
        select * from public.protected_records;
    `,
  });

  assert.deepEqual(violations, []);
});

test('accepts public views that preserve underlying RLS', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_safe.sql': `
      create view public.protected_record_view
        with (security_invoker = true) as
        select * from public.protected_records;
    `,
  });

  assert.deepEqual(violations, []);
});

test('rejects materialized views in the exposed public schema', () => {
  const violations = findSupabaseAccessControlViolations({
    [BASELINE_PATH]: BASELINE,
    'supabase/migrations/20260822000000_unsafe.sql': `
      create materialized view public.cached_records as
        select * from public.protected_records;
    `,
  });

  assert.equal(violations[0]?.code, 'supabase.materialized-view-exposure');
});
