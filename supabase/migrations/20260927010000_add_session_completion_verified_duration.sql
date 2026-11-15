-- Lets staff confirm a class_session_completions occurrence with its actual
-- verified duration instead of implicitly assuming the full scheduled length
-- (session_end_at - occurrence_key) — e.g. a teacher who only ran 30 of a
-- scheduled 60 minutes. verification_note records why, required (application-
-- side, in session-completions.service.ts adminConfirm) whenever
-- verified_minutes differs from the scheduled duration. Also used when
-- adminConfirm resolves an existing dispute (a parent reporting "not
-- completed full 1h") by confirming with the verified partial duration
-- instead of requiring a separate undo-dispute step.
alter table public.class_session_completions
  add column if not exists verified_minutes integer,
  add column if not exists verification_note text;
