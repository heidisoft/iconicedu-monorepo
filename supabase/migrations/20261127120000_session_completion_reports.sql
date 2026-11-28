-- Lets a participant report a session that was marked complete without them —
-- auto-confirmed after the confirmation deadline, or confirmed by staff on their
-- behalf — so staff can track wrongly-marked completions. A report flags the row
-- for staff review; it deliberately does NOT change `status`, so completion
-- counts stay put until staff correct the session with the existing admin
-- dispute / undo tools.
--
-- Also records who confirmed a 'confirmed' row in a dedicated `confirmed_by`
-- column. Until now the only signal was `updated_by <> profile_id`, which the
-- participant's own later writes (rate, skip-rating) overwrite — so a staff
-- confirmation was forgotten as soon as the participant rated the session.

alter table public.class_session_completions
  add column if not exists confirmed_by uuid,
  add column if not exists reported_at timestamptz,
  add column if not exists report_category text,
  add column if not exists report_reason text;

alter table public.class_session_completions
  drop constraint if exists class_session_completions_report_category_check;
alter table public.class_session_completions
  add constraint class_session_completions_report_category_check
    check (
      report_category is null
      or report_category in (
        'teacher_absent',
        'student_absent',
        'technical_issue',
        'did_not_happen',
        'other'
      )
    );

alter table public.class_session_completions
  drop constraint if exists class_session_completions_report_reason_length_check;
alter table public.class_session_completions
  add constraint class_session_completions_report_reason_length_check
    check (report_reason is null or char_length(report_reason) <= 500);

-- A report is all-or-nothing: a timestamp always comes with a category.
alter table public.class_session_completions
  drop constraint if exists class_session_completions_report_consistency_check;
alter table public.class_session_completions
  add constraint class_session_completions_report_consistency_check
    check ((reported_at is null) = (report_category is null));

-- Best-effort backfill for existing confirmations. A staff confirmation that the
-- participant has since rated already lost its `updated_by` signal, so it is
-- recorded as self-confirmed — that history cannot be reconstructed.
update public.class_session_completions
set confirmed_by = coalesce(updated_by, profile_id)
where status = 'confirmed'
  and confirmed_by is null;

-- Staff review queue: open reports per org, newest first.
create index if not exists class_session_completions_reported_idx
  on public.class_session_completions (org_id, reported_at desc)
  where reported_at is not null and deleted_at is null;
