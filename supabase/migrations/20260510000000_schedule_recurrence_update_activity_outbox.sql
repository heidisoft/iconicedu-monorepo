-- Ensure edits to cancellation/reschedule rows re-enter the unified activity pipeline.
-- The enqueue functions are idempotent by dedupe key; updates reset the outbox/job
-- to pending so activity projection and notification preparation run again.

drop trigger if exists session_exception_event_outbox_enqueue on public.class_schedule_recurrence_exceptions;
create trigger session_exception_event_outbox_enqueue
  after insert or update on public.class_schedule_recurrence_exceptions
  for each row
  execute function public.enqueue_session_cancel_event_outbox();

drop trigger if exists session_override_event_outbox_enqueue on public.class_schedule_recurrence_overrides;
create trigger session_override_event_outbox_enqueue
  after insert or update on public.class_schedule_recurrence_overrides
  for each row
  execute function public.enqueue_session_reschedule_event_outbox();

