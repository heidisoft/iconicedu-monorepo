-- get_org_session_completion_summary folds cross-party rows to occurrences,
-- windows the completed count by session_end_at, and leaves pending unbounded.
-- Run with `supabase test db` after applying migrations. Fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Insert completion rows directly without standing up class_schedules / profiles
-- fixtures: replica mode skips the FK triggers for this transaction.
set session_replication_role = replica;

insert into public.orgs (id, name, slug) values
  ('00000000-0000-4000-8000-0000000c5c01', 'Completion summary', 'completion-summary-test'),
  ('00000000-0000-4000-8000-0000000c5c02', 'Completion other', 'completion-summary-other');

insert into public.class_session_completions
  (org_id, schedule_id, occurrence_key, profile_id, role, status, session_end_at, expires_at)
values
  -- Occurrence A: two confirmations, ended in March -> completed once.
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5111',
   '2030-03-06T10:00:00Z', '00000000-0000-4000-8000-0000000c5201', 'educator',
   'confirmed', '2030-03-06T11:00:00Z', '2030-03-09T11:00:00Z'),
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5111',
   '2030-03-06T10:00:00Z', '00000000-0000-4000-8000-0000000c5202', 'guardian',
   'auto_confirmed', '2030-03-06T11:00:00Z', '2030-03-09T11:00:00Z'),
  -- Occurrence B: one confirmed, one pending, March -> completed, not pending.
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5111',
   '2030-03-13T10:00:00Z', '00000000-0000-4000-8000-0000000c5201', 'educator',
   'confirmed', '2030-03-13T11:00:00Z', '2030-03-16T11:00:00Z'),
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5111',
   '2030-03-13T10:00:00Z', '00000000-0000-4000-8000-0000000c5202', 'guardian',
   'pending', '2030-03-13T11:00:00Z', '2030-03-16T11:00:00Z'),
  -- Occurrence C: confirmed but ended in February -> outside the March window,
  -- and still excluded from pending because it is resolved.
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5111',
   '2030-02-25T10:00:00Z', '00000000-0000-4000-8000-0000000c5201', 'educator',
   'confirmed', '2030-02-25T11:00:00Z', '2030-02-28T11:00:00Z'),
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5111',
   '2030-02-25T10:00:00Z', '00000000-0000-4000-8000-0000000c5202', 'guardian',
   'pending', '2030-02-25T11:00:00Z', '2030-02-28T11:00:00Z'),
  -- Occurrence D: only pending rows -> pending, regardless of month.
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5112',
   '2030-01-05T10:00:00Z', '00000000-0000-4000-8000-0000000c5202', 'guardian',
   'pending', '2030-01-05T11:00:00Z', '2030-01-08T11:00:00Z'),
  -- Occurrence E: disputed only -> neither completed nor pending.
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5112',
   '2030-03-20T10:00:00Z', '00000000-0000-4000-8000-0000000c5201', 'educator',
   'disputed', '2030-03-20T11:00:00Z', '2030-03-23T11:00:00Z'),
  -- Soft-deleted confirmed row -> ignored.
  ('00000000-0000-4000-8000-0000000c5c01', '00000000-0000-4000-8000-0000000c5112',
   '2030-03-21T10:00:00Z', '00000000-0000-4000-8000-0000000c5201', 'educator',
   'confirmed', '2030-03-21T11:00:00Z', '2030-03-24T11:00:00Z'),
  -- Another org's confirmed row -> never counted for org A.
  ('00000000-0000-4000-8000-0000000c5c02', '00000000-0000-4000-8000-0000000c5113',
   '2030-03-06T10:00:00Z', '00000000-0000-4000-8000-0000000c5203', 'educator',
   'confirmed', '2030-03-06T11:00:00Z', '2030-03-09T11:00:00Z');

update public.class_session_completions
   set deleted_at = now()
 where org_id = '00000000-0000-4000-8000-0000000c5c01'
   and occurrence_key = '2030-03-21T10:00:00Z';

set session_replication_role = origin;

-- Windowed to March 2030.
select is(
  (select completed from public.get_org_session_completion_summary(
     '00000000-0000-4000-8000-0000000c5c01',
     '2030-03-01T00:00:00Z', '2030-04-01T00:00:00Z')),
  2, 'completed counts March occurrences A and B once each');
select is(
  (select pending from public.get_org_session_completion_summary(
     '00000000-0000-4000-8000-0000000c5c01',
     '2030-03-01T00:00:00Z', '2030-04-01T00:00:00Z')),
  1, 'pending counts only the fully unresolved occurrence D');

-- Unbounded window: completed also picks up February; pending is unchanged.
select is(
  (select completed from public.get_org_session_completion_summary(
     '00000000-0000-4000-8000-0000000c5c01', null, null)),
  3, 'unbounded completed adds the February occurrence C');
select is(
  (select pending from public.get_org_session_completion_summary(
     '00000000-0000-4000-8000-0000000c5c01', null, null)),
  1, 'pending stays at the one unresolved occurrence');

-- Org isolation.
select is(
  (select completed from public.get_org_session_completion_summary(
     '00000000-0000-4000-8000-0000000c5c02', null, null)),
  1, 'the other org sees only its own confirmed occurrence');

-- An org with no rows still returns a zero row, never null.
select is(
  (select completed from public.get_org_session_completion_summary(
     '00000000-0000-4000-8000-000000000fff', null, null)),
  0, 'an unknown org returns zero');

select * from finish();
rollback;
