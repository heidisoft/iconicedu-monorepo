-- created_by on assessment tables was accidentally FK'd to profiles.id.
-- The API passes auth.uid() (auth user ID) not a profile ID, so drop the FK
-- and keep created_by as a plain UUID audit field.

alter table public.assessment_subjects
  drop constraint if exists assessment_subjects_created_by_fkey;

alter table public.assessment_tests
  drop constraint if exists assessment_tests_created_by_fkey;

alter table public.assessment_deliveries
  drop constraint if exists assessment_deliveries_created_by_fkey;

alter table public.assessment_items
  drop constraint if exists assessment_items_created_by_fkey;
