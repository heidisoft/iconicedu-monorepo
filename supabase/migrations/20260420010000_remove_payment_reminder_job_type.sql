alter table public.reminder_jobs
  drop constraint if exists reminder_jobs_job_type_check;

alter table public.reminder_jobs
  add constraint reminder_jobs_job_type_check
  check (job_type in ('session.reminder', 'session.feedback_request'));
