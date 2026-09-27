-- Issue #264 (messaging P2): scheduled send. A message is held until
-- send_at (an absolute UTC instant computed client-side from the sender's
-- chosen local date/time + timezone) and only actually created as a real
-- message row when the dispatcher claims and sends it — authorization
-- (channel membership, sender profile still active) is re-checked at that
-- point, not just at schedule time, per the issue's explicit requirement.

create table public.scheduled_messages (
  id uuid primary key default uuid_generate_v7(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id),
  content text not null,
  mentions jsonb not null default '[]'::jsonb,
  thread_parent_id uuid references public.messages(id) on delete set null,
  thread_id uuid references public.threads(id) on delete set null,
  send_at timestamptz not null,
  timezone text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'canceled', 'failed')),
  dispatched_message_id uuid references public.messages(id) on delete set null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  lease_owner text,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

create index scheduled_messages_due_idx
  on public.scheduled_messages (status, send_at, lease_until)
  where deleted_at is null and status = 'pending';

create index scheduled_messages_sender_idx
  on public.scheduled_messages (org_id, sender_profile_id, status, send_at)
  where deleted_at is null;

alter table public.scheduled_messages enable row level security;

-- Scheduled messages are private to their sender until they're actually
-- sent (at which point they become a normal message, governed by the
-- normal messages RLS policies instead).
create policy "scheduled messages select self"
  on public.scheduled_messages for select
  to authenticated
  using (deleted_at is null and public.is_profile_owner(sender_profile_id));

create policy "scheduled messages write self"
  on public.scheduled_messages for all
  to authenticated
  using (
    deleted_at is null
    and status = 'pending'
    and public.is_profile_owner(sender_profile_id)
  )
  with check (
    deleted_at is null
    and public.is_profile_owner(sender_profile_id)
  );

create or replace function public.claim_due_scheduled_messages(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer
)
returns setof public.scheduled_messages
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.scheduled_messages sm
    set lease_owner = p_lease_owner,
        lease_until = now() + make_interval(secs => greatest(p_lease_seconds, 1)),
        updated_at = now()
    from (
      select id
        from public.scheduled_messages
       where status = 'pending'
         and deleted_at is null
         and send_at <= now()
         and (lease_until is null or lease_until < now())
       order by send_at
       limit greatest(p_limit, 1)
         for update skip locked
    ) due
   where sm.id = due.id
  returning sm.*;
end;
$$;

revoke all on function public.claim_due_scheduled_messages(integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_messages(integer, text, integer)
  to service_role;

-- ─── Cron: dispatch due scheduled messages every minute ────────────────────

create or replace function public.configure_edge_function_cron(p_project_url text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_project_url text;
  v_job record;
begin
  v_project_url := trim(coalesce(p_project_url, ''));

  if v_project_url = '' then
    raise exception 'p_project_url is required';
  end if;

  v_project_url := regexp_replace(v_project_url, '/+$', '');

  perform cron.unschedule(existing.jobid)
  from cron.job existing
  where existing.jobname in (
    'edge-function-reminders-reconcile-dispatch',
    'edge-function-activity-worker-dispatch',
    'edge-function-activity-projector-dispatch',
    'edge-function-notifications-dispatch'
  );

  for v_job in
    select *
    from (
      values
        (
          'edge-function-events-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/events-dispatch'
        ),
        (
          'edge-function-reminders-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/reminders-dispatch'
        ),
        (
          'edge-function-session-completions-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/session-completions-dispatch'
        ),
        (
          'edge-function-push-notifications-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/push-notifications-dispatch'
        ),
        (
          'edge-function-schedule-reconciliation-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/schedule-reconciliation-dispatch'
        ),
        (
          'edge-function-channel-read-state-repair',
          '0 3 * * *',
          v_project_url || '/functions/v1/channel-read-state-repair'
        ),
        (
          'edge-function-scheduled-messages-dispatch',
          '* * * * *',
          v_project_url || '/functions/v1/scheduled-messages-dispatch'
        )
    ) as jobs(job_name, cron_schedule, target_url)
  loop
    perform cron.unschedule(existing.jobid)
    from cron.job existing
    where existing.jobname = v_job.job_name;

    perform cron.schedule(
      v_job.job_name,
      v_job.cron_schedule,
      format(
        $sql$
          select net.http_post(
            url := %L,
            body := '{}'::jsonb
          ) as request_id;
        $sql$,
        v_job.target_url
      )
    );
  end loop;
end;
$function$;

comment on function public.configure_edge_function_cron(text) is
  'Schedules independent event, reminder, completion-check, push-delivery, schedule-reconciliation, scheduled-message-send and maintenance workers.';
