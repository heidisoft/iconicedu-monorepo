-- Adds 'did_not_happen' to the class_session_completions.dispute_category
-- check constraint, so staff can report a session as not having happened at
-- all (neither party showed up) without guessing teacher_absent vs
-- student_absent.
alter table public.class_session_completions
  drop constraint if exists class_session_completions_dispute_category_check;

alter table public.class_session_completions
  add constraint class_session_completions_dispute_category_check
    check (
      dispute_category in (
        'teacher_absent',
        'student_absent',
        'technical_issue',
        'did_not_happen',
        'other'
      )
    );
