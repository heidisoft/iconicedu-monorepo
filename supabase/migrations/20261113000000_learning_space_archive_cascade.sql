-- Class (learning space) archive / delete lifecycle.
--
-- Problem: archiving a class only flipped learning_spaces.status. The class
-- channel stayed active and writable, members and participants kept access,
-- tutor <-> student/guardian DMs that only existed because of the class stayed
-- open, and pending reminders / scheduled messages kept firing. Deleting a
-- class hard-deleted channels and learning_spaces rows, which cascades into
-- live-session attendance, feedback, quality events, messages and session
-- summaries (reports).
--
-- Design (no new tables or columns; see docs/operations/class-archive-lifecycle.md):
-- * Archived/deleted is decided by the existing columns:
--     status = 'archived' or archived_at is not null or deleted_at is not null.
-- * The cascade is driven by an AFTER UPDATE trigger on learning_spaces so the
--   invariant holds whoever writes the row (API, legacy admin routes, SQL).
-- * "Connections" are soft-removed: class channel_members and
--   learning_space_participants get deleted_at = the class archive stamp
--   (learning_spaces.archived_at). Restore reverses exactly the rows carrying
--   that stamp, so people removed earlier stay removed.
-- * Tutor <-> student/guardian DMs are archived (read-only, history and
--   membership retained for safeguarding/audit) when no other active class
--   still connects the pair. They carry the same stamp so a restore can
--   reopen them without reopening DMs an admin archived by hand.
-- * Reports are never touched: class_session_completions, class_schedules,
--   channel_live_sessions and their participants/events/feedback, messages
--   (including session summaries), message_session_feedback.
-- * Hard deletes of learning_spaces and class channels are blocked; delete is
--   a soft delete with a 30-day restore window.
-- * A daily job reconciles drifted rows and purges ephemeral per-user state
--   past retention. Messages and reports are retained.

-- ─── Indexes ───────────────────────────────────────────────────────────────

create index if not exists learning_space_channels_space_idx
  on public.learning_space_channels (learning_space_id);

create index if not exists learning_space_channels_channel_idx
  on public.learning_space_channels (channel_id);

create index if not exists channels_primary_entity_idx
  on public.channels (primary_entity_id)
  where primary_entity_id is not null;

create index if not exists family_links_child_account_idx
  on public.family_links (org_id, child_account_id)
  where deleted_at is null;

create index if not exists learning_spaces_archived_at_idx
  on public.learning_spaces (archived_at)
  where archived_at is not null;

create index if not exists learning_spaces_deleted_at_idx
  on public.learning_spaces (deleted_at)
  where deleted_at is not null;

create index if not exists channels_archived_dm_idx
  on public.channels (archived_at)
  where kind = 'dm' and status = 'archived';

-- ─── Read helpers ──────────────────────────────────────────────────────────

-- Stamp used only by the one-off backfill below for tutor <-> learner DMs that
-- lost their class through the old hard-delete path (no class row remains).
create or replace function public.learning_space_archive_backfill_stamp()
returns timestamptz
language sql
immutable
as $$ select timestamptz '2026-11-13 00:00:00+00' $$;

create or replace function public.is_learning_space_archived(
  p_status public.learning_space_status,
  p_archived_at timestamptz,
  p_deleted_at timestamptz
)
returns boolean
language sql
immutable
as $$
  select p_status = 'archived' or p_archived_at is not null or p_deleted_at is not null
$$;

-- Class channels: the link table plus channels.primary_entity_id, because the
-- old delete path removed learning_space_channels rows before failing.
create or replace function public.learning_space_class_channel_ids(p_learning_space_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select lsc.channel_id
  from public.learning_space_channels lsc
  join public.channels c on c.id = lsc.channel_id and c.kind = 'channel'
  where lsc.learning_space_id = p_learning_space_id
  union
  select c.id
  from public.channels c
  where c.primary_entity_id = p_learning_space_id
    and c.primary_entity_kind = 'learning_space'
    and c.kind = 'channel'
$$;

-- Current (not soft-removed) members of a class.
create or replace function public.learning_space_member_profile_ids(p_learning_space_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select lsp.profile_id
  from public.learning_space_participants lsp
  where lsp.learning_space_id = p_learning_space_id
    and lsp.deleted_at is null
  union
  select cm.profile_id
  from public.channel_members cm
  where cm.channel_id in (select public.learning_space_class_channel_ids(p_learning_space_id))
    and cm.deleted_at is null
$$;

-- Tutor <-> learner pairs a class connects: every educator member paired with
-- every child or guardian member, plus guardians of child members.
create or replace function public.learning_space_tutor_contact_pairs(p_learning_space_id uuid)
returns table (org_id uuid, educator_profile_id uuid, contact_profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with members as (
    select p.id, p.org_id, p.kind, p.account_id
    from public.profiles p
    where p.id in (select public.learning_space_member_profile_ids(p_learning_space_id))
  ),
  contacts as (
    select m.id, m.org_id from members m where m.kind in ('child', 'guardian')
    union
    select g.id, g.org_id
    from members m
    join public.family_links fl
      on fl.org_id = m.org_id
     and fl.child_account_id = m.account_id
     and fl.deleted_at is null
    join public.profiles g
      on g.org_id = m.org_id
     and g.account_id = fl.guardian_account_id
     and g.kind = 'guardian'
     and g.deleted_at is null
    where m.kind = 'child'
  )
  select e.org_id, e.id, c.id
  from members e
  join contacts c on c.org_id = e.org_id and c.id <> e.id
  where e.kind = 'educator'
$$;

-- True while at least one non-archived, non-deleted class connects the pair.
-- Also the eligibility check for tutor <-> learner DMs in apps/api.
create or replace function public.tutor_contact_has_active_class(
  p_org_id uuid,
  p_educator_profile_id uuid,
  p_contact_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.learning_spaces ls
    cross join lateral public.learning_space_tutor_contact_pairs(ls.id) pr
    where ls.org_id = p_org_id
      and not public.is_learning_space_archived(ls.status, ls.archived_at, ls.deleted_at)
      and ls.id in (
        select lsp.learning_space_id
        from public.learning_space_participants lsp
        where lsp.org_id = p_org_id
          and lsp.profile_id = p_educator_profile_id
          and lsp.deleted_at is null
        union
        select coalesce(lsc.learning_space_id, c.primary_entity_id)
        from public.channel_members cm
        join public.channels c on c.id = cm.channel_id and c.kind = 'channel'
        left join public.learning_space_channels lsc on lsc.channel_id = c.id
        where cm.org_id = p_org_id
          and cm.profile_id = p_educator_profile_id
          and cm.deleted_at is null
      )
      and pr.educator_profile_id = p_educator_profile_id
      and pr.contact_profile_id = p_contact_profile_id
  )
$$;

-- 1:1 DM channels (any status, not deleted) whose members include both profiles.
create or replace function public.tutor_contact_dm_channel_ids(
  p_org_id uuid,
  p_profile_a uuid,
  p_profile_b uuid
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.channels c
  where c.org_id = p_org_id
    and c.kind = 'dm'
    and c.deleted_at is null
    and exists (
      select 1 from public.channel_members a
      where a.channel_id = c.id and a.profile_id = p_profile_a and a.deleted_at is null
    )
    and exists (
      select 1 from public.channel_members b
      where b.channel_id = c.id and b.profile_id = p_profile_b and b.deleted_at is null
    )
$$;

-- ─── Cascade cores (internal) ──────────────────────────────────────────────

create or replace function public.archive_learning_space_core(
  p_learning_space_id uuid,
  p_stamp timestamptz,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_channel_ids uuid[];
  v_pair record;
  v_dm_ids uuid[] := '{}';
  v_batch uuid[];
  v_count bigint;
  v_result jsonb := '{}'::jsonb;
begin
  select org_id into v_org_id from public.learning_spaces where id = p_learning_space_id;
  if v_org_id is null then
    raise exception 'learning space % not found', p_learning_space_id using errcode = 'P0002';
  end if;

  select coalesce(array_agg(id), '{}') into v_channel_ids
  from public.learning_space_class_channel_ids(p_learning_space_id) as id;

  -- Normalize the class row; a no-op when it is already consistent, so the
  -- sync trigger is not re-entered with a state transition.
  update public.learning_spaces
     set status = 'archived',
         archived_at = coalesce(archived_at, p_stamp)
   where id = p_learning_space_id
     and (status <> 'archived' or archived_at is null);

  -- Tutor <-> learner DMs: capture pairs before memberships are removed.
  for v_pair in
    select * from public.learning_space_tutor_contact_pairs(p_learning_space_id)
  loop
    -- Defer the connectivity check until this class no longer counts.
    v_batch := array(
      select public.tutor_contact_dm_channel_ids(v_pair.org_id, v_pair.educator_profile_id, v_pair.contact_profile_id)
    );
    if array_length(v_batch, 1) is not null
       and not public.tutor_contact_has_active_class(v_pair.org_id, v_pair.educator_profile_id, v_pair.contact_profile_id)
    then
      v_dm_ids := v_dm_ids || v_batch;
    end if;
  end loop;

  update public.channels
     set status = 'archived', archived_at = p_stamp
   where id = any(v_dm_ids) and status = 'active';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('dms_archived', v_count);

  update public.channels
     set status = 'archived', archived_at = coalesce(archived_at, p_stamp)
   where id = any(v_channel_ids) and (status <> 'archived' or archived_at is null);
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('class_channels_archived', v_count);

  update public.channel_members
     set deleted_at = p_stamp, deleted_by = p_actor_profile_id
   where channel_id = any(v_channel_ids) and deleted_at is null;
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('channel_members_removed', v_count);

  update public.learning_space_participants
     set deleted_at = p_stamp, deleted_by = p_actor_profile_id
   where learning_space_id = p_learning_space_id and deleted_at is null;
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('participants_removed', v_count);

  -- Future work only. Dispatched reminders and their logs are history.
  update public.reminder_jobs
     set status = 'canceled', lease_owner = null, lease_until = null, updated_at = now()
   where org_id = v_org_id
     and deleted_at is null
     and status not in ('succeeded', 'canceled', 'dead_letter')
     and (
       source_learning_space_id = p_learning_space_id
       or (target_kind = 'channel' and target_id = any(v_channel_ids))
     );
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('reminder_jobs_canceled', v_count);

  update public.scheduled_messages
     set status = 'canceled', lease_owner = null, lease_until = null, updated_at = now()
   where channel_id = any(v_channel_ids || v_dm_ids)
     and status = 'pending'
     and deleted_at is null;
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('scheduled_messages_canceled', v_count);

  return v_result;
end;
$$;

-- True when a channel's archived_at was written by the class lifecycle: the
-- archive or delete stamp of a class in the same org, or the backfill stamp.
-- A channel an admin archived by hand carries an unrelated stamp.
create or replace function public.is_class_lifecycle_archive_stamp(
  p_org_id uuid,
  p_archived_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_archived_at is not null and (
    p_archived_at = public.learning_space_archive_backfill_stamp()
    or exists (
      select 1 from public.learning_spaces ls
      where ls.org_id = p_org_id
        and (ls.archived_at = p_archived_at or ls.deleted_at = p_archived_at)
    )
  )
$$;

create or replace function public.restore_learning_space_core(
  p_learning_space_id uuid,
  p_stamp timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_ids uuid[];
  v_pair record;
  v_count bigint;
  v_dm_count bigint := 0;
  v_result jsonb := '{}'::jsonb;
begin
  select coalesce(array_agg(id), '{}') into v_channel_ids
  from public.learning_space_class_channel_ids(p_learning_space_id) as id;

  if p_stamp is not null then
    update public.learning_space_participants
       set deleted_at = null, deleted_by = null
     where learning_space_id = p_learning_space_id and deleted_at = p_stamp;
    get diagnostics v_count = row_count;
    v_result := v_result || jsonb_build_object('participants_restored', v_count);

    update public.channel_members
       set deleted_at = null, deleted_by = null
     where channel_id = any(v_channel_ids) and deleted_at = p_stamp;
    get diagnostics v_count = row_count;
    v_result := v_result || jsonb_build_object('channel_members_restored', v_count);
  end if;

  -- Only class channels this archive stamped. A class channel archived on its
  -- own before the class keeps its earlier stamp (archive uses coalesce) and
  -- stays archived.
  update public.channels
     set status = 'active', archived_at = null
   where id = any(v_channel_ids) and deleted_at is null
     and (status <> 'active' or archived_at is not null)
     and archived_at is not distinct from p_stamp;
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('class_channels_restored', v_count);

  -- Reopen DMs the class lifecycle archived (this class, another class, or the
  -- backfill). DMs an admin archived by hand carry an unrelated stamp and stay
  -- archived.
  for v_pair in
    select * from public.learning_space_tutor_contact_pairs(p_learning_space_id)
  loop
    update public.channels c
       set status = 'active', archived_at = null
     where c.id in (
             select public.tutor_contact_dm_channel_ids(v_pair.org_id, v_pair.educator_profile_id, v_pair.contact_profile_id)
           )
       and c.status = 'archived'
       and (
         c.archived_at = p_stamp
         or public.is_class_lifecycle_archive_stamp(c.org_id, c.archived_at)
       );
    get diagnostics v_count = row_count;
    v_dm_count := v_dm_count + v_count;
  end loop;
  v_result := v_result || jsonb_build_object('dms_restored', v_dm_count);

  return v_result;
end;
$$;

revoke all on function public.archive_learning_space_core(uuid, timestamptz, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.restore_learning_space_core(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.learning_space_class_channel_ids(uuid)
  from public, anon, authenticated;
revoke all on function public.learning_space_member_profile_ids(uuid)
  from public, anon, authenticated;
revoke all on function public.learning_space_tutor_contact_pairs(uuid)
  from public, anon, authenticated;
revoke all on function public.tutor_contact_dm_channel_ids(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.tutor_contact_has_active_class(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.tutor_contact_has_active_class(uuid, uuid, uuid)
  to service_role;
revoke all on function public.is_class_lifecycle_archive_stamp(uuid, timestamptz)
  from public, anon, authenticated;

-- ensure-dm reopens an archived tutor DM when a class connects the pair again,
-- but only if the class lifecycle archived it. A DM an admin archived by hand
-- stays archived; returns false.
create or replace function public.reopen_class_lifecycle_dm(
  p_org_id uuid,
  p_channel_id uuid,
  p_actor_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.channels c
     set status = 'active',
         archived_at = null,
         updated_at = now(),
         updated_by = p_actor_profile_id
   where c.id = p_channel_id
     and c.org_id = p_org_id
     and c.kind = 'dm'
     and c.status = 'archived'
     and c.deleted_at is null
     and public.is_class_lifecycle_archive_stamp(c.org_id, c.archived_at);
  return found;
end;
$$;

revoke all on function public.reopen_class_lifecycle_dm(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reopen_class_lifecycle_dm(uuid, uuid, uuid)
  to service_role;

-- ─── Sync trigger ──────────────────────────────────────────────────────────
-- Fires only on an active <-> archived transition, so normalizing updates made
-- by the cores never recurse. Actor comes from the RPC wrappers below.

create or replace function public.sync_learning_space_archive_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was boolean := public.is_learning_space_archived(old.status, old.archived_at, old.deleted_at);
  v_is boolean := public.is_learning_space_archived(new.status, new.archived_at, new.deleted_at);
  v_actor uuid := nullif(current_setting('app.actor_profile_id', true), '')::uuid;
begin
  if v_is and not v_was then
    perform public.archive_learning_space_core(
      new.id, coalesce(new.archived_at, new.deleted_at, now()), v_actor);
  elsif v_was and not v_is then
    perform public.restore_learning_space_core(new.id, coalesce(old.archived_at, old.deleted_at));
  end if;
  return null;
end;
$$;

drop trigger if exists sync_learning_space_archive_state on public.learning_spaces;
create trigger sync_learning_space_archive_state
  after update of status, archived_at, deleted_at on public.learning_spaces
  for each row
  execute function public.sync_learning_space_archive_state();

-- ─── Report protection ─────────────────────────────────────────────────────
-- Hard-deleting a class or its channel cascades into reports. Org deletion
-- (a cascaded delete, trigger depth > 1) and an explicit, audited erasure
-- request (SET LOCAL app.allow_class_hard_delete = 'on') are still allowed.

create or replace function public.prevent_class_hard_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1
     or current_setting('app.allow_class_hard_delete', true) = 'on' then
    return old;
  end if;
  -- Nested IF: plpgsql does not short-circuit, and learning_spaces.kind is a
  -- different enum, so old.kind must only be read for channels.
  if tg_table_name = 'channels' then
    if old.kind::text <> 'channel' or old.primary_entity_kind is distinct from 'learning_space' then
      return old;
    end if;
  end if;
  raise exception 'Hard delete of % % is not allowed; use public.delete_learning_space()', tg_table_name, old.id
    using errcode = '42501',
          hint = 'Classes are soft-deleted so attendance, completions, feedback and summaries are retained.';
end;
$$;

drop trigger if exists prevent_class_hard_delete on public.learning_spaces;
create trigger prevent_class_hard_delete
  before delete on public.learning_spaces
  for each row execute function public.prevent_class_hard_delete();

drop trigger if exists prevent_class_hard_delete on public.channels;
create trigger prevent_class_hard_delete
  before delete on public.channels
  for each row execute function public.prevent_class_hard_delete();

-- ─── Read-only archived channels ───────────────────────────────────────────
-- Same as 20260613000000 plus: the channel must be active and not deleted.
-- System reminders (first branch of can_insert_message) already skip archived
-- classes before posting.

create or replace function public.can_post_to_channel_as_profile(
  _org_id uuid,
  _channel_id uuid,
  _profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_act_as_profile(_org_id, _profile_id)
    and exists (
      select 1
      from public.channels ch
      where ch.id = _channel_id
        and ch.org_id = _org_id
        and ch.status = 'active'
        and ch.deleted_at is null
    )
    and (
      exists (
        select 1
        from public.channel_members cm
        where cm.org_id = _org_id
          and cm.channel_id = _channel_id
          and cm.profile_id = _profile_id
          and cm.deleted_at is null
      )
      or exists (
        select 1
        from public.channels c
        where c.id = _channel_id
          and c.org_id = _org_id
          and c.purpose = 'support'
          and c.deleted_at is null
          and public.is_org_member(_org_id)
      )
      or exists (
        select 1
        from public.channels c
        where c.id = _channel_id
          and c.org_id = _org_id
          and c.visibility = 'public'
          and c.deleted_at is null
          and public.is_org_member(_org_id)
      )
      or public.can_operationally_post_to_classroom_channel(
        _org_id,
        _channel_id,
        _profile_id
      )
    );
$$;

-- ─── API entry points (service_role only) ──────────────────────────────────

-- A live class must be ended through its provider before it is archived, so
-- attendance and session summaries are finalized first.
create or replace function public.assert_learning_space_not_live(p_learning_space_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.channel_live_sessions s
    where s.channel_id in (select public.learning_space_class_channel_ids(p_learning_space_id))
      and s.status in ('starting', 'live')
      and s.deleted_at is null
  ) then
    raise exception 'End the live session before archiving or deleting this class'
      using errcode = '55006';
  end if;
end;
$$;

revoke all on function public.assert_learning_space_not_live(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.archive_learning_space(
  p_org_id uuid,
  p_learning_space_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
as $$
declare
  v_space public.learning_spaces%rowtype;
begin
  select * into v_space from public.learning_spaces
   where id = p_learning_space_id and org_id = p_org_id
   for update;
  if not found or v_space.deleted_at is not null then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if public.is_learning_space_archived(v_space.status, v_space.archived_at, v_space.deleted_at) then
    -- Idempotent: finish any drift left by an earlier partial write.
    return jsonb_build_object('already_archived', true)
      || public.archive_learning_space_core(v_space.id, coalesce(v_space.archived_at, now()), p_actor_profile_id);
  end if;

  perform public.assert_learning_space_not_live(v_space.id);

  perform set_config('app.actor_profile_id', coalesce(p_actor_profile_id::text, ''), true);
  update public.learning_spaces
     set status = 'archived', archived_at = now()
   where id = v_space.id;
  perform set_config('app.actor_profile_id', '', true);
  return jsonb_build_object('archived', true);
end;
$$;

create or replace function public.restore_learning_space(
  p_org_id uuid,
  p_learning_space_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
as $$
declare
  v_space public.learning_spaces%rowtype;
begin
  select * into v_space from public.learning_spaces
   where id = p_learning_space_id and org_id = p_org_id
   for update;
  if not found then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if v_space.deleted_at is not null and v_space.deleted_at < now() - interval '30 days' then
    raise exception 'Class was deleted more than 30 days ago and can no longer be restored'
      using errcode = '55000';
  end if;
  if not public.is_learning_space_archived(v_space.status, v_space.archived_at, v_space.deleted_at) then
    return jsonb_build_object('already_active', true);
  end if;

  perform set_config('app.actor_profile_id', coalesce(p_actor_profile_id::text, ''), true);
  update public.learning_spaces
     set status = 'active', archived_at = null, deleted_at = null, deleted_by = null
   where id = v_space.id;
  perform set_config('app.actor_profile_id', '', true);
  return jsonb_build_object('restored', true);
end;
$$;

create or replace function public.delete_learning_space(
  p_org_id uuid,
  p_learning_space_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
as $$
declare
  v_space public.learning_spaces%rowtype;
begin
  select * into v_space from public.learning_spaces
   where id = p_learning_space_id and org_id = p_org_id
   for update;
  if not found then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if v_space.deleted_at is not null then
    return jsonb_build_object('already_deleted', true);
  end if;

  perform public.assert_learning_space_not_live(v_space.id);

  perform set_config('app.actor_profile_id', coalesce(p_actor_profile_id::text, ''), true);
  update public.learning_spaces
     set status = 'archived',
         archived_at = coalesce(archived_at, now()),
         deleted_at = now(),
         deleted_by = p_actor_profile_id
   where id = v_space.id;
  perform set_config('app.actor_profile_id', '', true);
  return jsonb_build_object('deleted', true, 'restorable_until', now() + interval '30 days');
end;
$$;

revoke all on function public.archive_learning_space(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.restore_learning_space(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_learning_space(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.archive_learning_space(uuid, uuid, uuid) to service_role;
grant execute on function public.restore_learning_space(uuid, uuid, uuid) to service_role;
grant execute on function public.delete_learning_space(uuid, uuid, uuid) to service_role;

-- ─── Reconcile (backfill + daily safety net) ───────────────────────────────
-- Finishes the cascade for any archived/deleted class that still has an
-- active class channel, active members, or active participants.

create or replace function public.reconcile_archived_learning_spaces(p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
as $$
declare
  v_space record;
  v_spaces integer := 0;
begin
  for v_space in
    select ls.id, coalesce(ls.archived_at, ls.deleted_at, ls.updated_at, now()) as stamp
    from public.learning_spaces ls
    where public.is_learning_space_archived(ls.status, ls.archived_at, ls.deleted_at)
      and (
        ls.status <> 'archived'
        or ls.archived_at is null
        or exists (
          select 1 from public.learning_space_participants p
          where p.learning_space_id = ls.id and p.deleted_at is null
        )
        or exists (
          select 1
          from public.channels c
          where c.id in (select public.learning_space_class_channel_ids(ls.id))
            and (
              c.status <> 'archived'
              or exists (
                select 1 from public.channel_members cm
                where cm.channel_id = c.id and cm.deleted_at is null
              )
            )
        )
      )
    order by ls.id
    limit least(greatest(coalesce(p_limit, 500), 1), 5000)
    for update of ls skip locked
  loop
    perform public.archive_learning_space_core(v_space.id, v_space.stamp, null);
    v_spaces := v_spaces + 1;
  end loop;

  return jsonb_build_object('spaces_reconciled', v_spaces);
end;
$$;

revoke all on function public.reconcile_archived_learning_spaces(integer) from public, anon, authenticated;
grant execute on function public.reconcile_archived_learning_spaces(integer) to service_role;

-- ─── Retention ─────────────────────────────────────────────────────────────
-- Ephemeral per-user state only. Messages, media, whiteboards of archived
-- classes, and every report table are retained (see the ops doc).
--   deleted class, 30 days after deleted_at:   read state, saves, pins,
--     unsent scheduled messages, annotation snapshots, whiteboards
--   archived class / archived DM, 365 days:    read state, saves, pins,
--     unsent scheduled messages, annotation snapshots

-- Bounded, lock-friendly batch delete. Shared with the notification-job
-- retention migration, which defines the identical function; keep the two
-- definitions byte-for-byte equal so migration order does not matter.
create or replace function public.purge_rows_in_batches(
  p_table regclass,
  p_predicate text,
  p_batch_size integer,
  p_max_batches integer
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint := 0;
  v_batch bigint;
  v_iterations integer := 0;
begin
  loop
    execute format(
      'with doomed as (
         select ctid from %1$s where %2$s limit %3$s for update skip locked
       )
       delete from %1$s t using doomed where t.ctid = doomed.ctid',
      p_table, p_predicate, p_batch_size
    );
    get diagnostics v_batch = row_count;
    v_deleted := v_deleted + v_batch;
    v_iterations := v_iterations + 1;
    exit when v_batch < p_batch_size or v_iterations >= p_max_batches;
  end loop;
  return v_deleted;
end;
$$;

revoke all on function public.purge_rows_in_batches(regclass, text, integer, integer)
  from public, anon, authenticated, service_role;

create or replace function public.archived_class_channel_ids_due_for_purge(p_include_archived boolean)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ch.id
  from public.learning_spaces ls
  cross join lateral public.learning_space_class_channel_ids(ls.id) as ch(id)
  where ls.deleted_at is not null
    and ls.deleted_at < now() - interval '30 days'
  union
  select ch.id
  from public.learning_spaces ls
  cross join lateral public.learning_space_class_channel_ids(ls.id) as ch(id)
  where p_include_archived
    and ls.deleted_at is null
    and ls.archived_at is not null
    and ls.archived_at < now() - interval '365 days'
  union
  select c.id
  from public.channels c
  where p_include_archived
    and c.kind = 'dm'
    and c.status = 'archived'
    and c.deleted_at is null
    and c.archived_at < now() - interval '365 days'
$$;

revoke all on function public.archived_class_channel_ids_due_for_purge(boolean)
  from public, anon, authenticated, service_role;

create or replace function public.purge_archived_learning_space_artifacts(
  p_batch_size integer default 5000,
  p_max_batches integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
as $$
declare
  v_batch integer := least(greatest(coalesce(p_batch_size, 5000), 100), 20000);
  v_max integer := least(greatest(coalesce(p_max_batches, 20), 1), 200);
  v_result jsonb := public.reconcile_archived_learning_spaces();
  v_due constant text := 'channel_id in (select public.archived_class_channel_ids_due_for_purge(true))';
  v_deleted constant text := 'channel_id in (select public.archived_class_channel_ids_due_for_purge(false))';
begin
  v_result := v_result
    || jsonb_build_object('channel_read_state',
         public.purge_rows_in_batches('public.channel_read_state', v_due, v_batch, v_max))
    || jsonb_build_object('message_saves',
         public.purge_rows_in_batches('public.message_saves', v_due, v_batch, v_max))
    || jsonb_build_object('message_pins',
         public.purge_rows_in_batches('public.message_pins', v_due, v_batch, v_max))
    || jsonb_build_object('scheduled_messages',
         public.purge_rows_in_batches('public.scheduled_messages',
           v_due || $p$ and status in ('pending', 'canceled', 'failed')$p$, v_batch, v_max))
    || jsonb_build_object('screen_annotation_sessions',
         public.purge_rows_in_batches('public.screen_annotation_sessions',
           'live_session_id in (select s.id from public.channel_live_sessions s where s.'
             || v_due || ')', v_batch, v_max))
    || jsonb_build_object('classroom_whiteboards',
         public.purge_rows_in_batches('public.classroom_whiteboards', v_deleted, v_batch, v_max));

  raise log 'purge_archived_learning_space_artifacts: %', v_result;
  return v_result;
end;
$$;

comment on function public.purge_archived_learning_space_artifacts(integer, integer) is
  'Reconciles archived classes, then deletes ephemeral per-user state of deleted (30d) and archived (365d) classes and archived DMs. Reports and messages are retained. Scheduled daily by pg_cron job learning-space-archive-retention.';

revoke all on function public.purge_archived_learning_space_artifacts(integer, integer)
  from public, anon, authenticated;
grant execute on function public.purge_archived_learning_space_artifacts(integer, integer)
  to service_role;

do $jobs$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'learning-space-archive-retention';

    perform cron.schedule(
      'learning-space-archive-retention',
      '23 3 * * *',
      'select public.purge_archived_learning_space_artifacts();'
    );
  end if;
end $jobs$;

-- ─── One-off backfill ──────────────────────────────────────────────────────

do $backfill$
declare
  v_reconciled jsonb;
  v_orphans bigint;
begin
  -- 1. Make status and archived_at agree. Readers already treat either as
  --    archived, so the archived side wins. The sync trigger does not fire
  --    here because each row is already archived on both sides of the update.
  update public.learning_spaces
     set archived_at = coalesce(deleted_at, updated_at, now())
   where status = 'archived' and archived_at is null;

  update public.learning_spaces
     set status = 'archived'
   where status <> 'archived' and (archived_at is not null or deleted_at is not null);

  -- 2. Finish the cascade for every archived/deleted class.
  loop
    v_reconciled := public.reconcile_archived_learning_spaces(5000);
    raise notice 'learning space archive backfill: %', v_reconciled;
    exit when (v_reconciled ->> 'spaces_reconciled')::integer < 5000;
  end loop;

  -- 3. Tutor <-> learner DMs whose class was hard-deleted by the old path, or
  --    that no active class connects any more. Staff, support and
  --    tutor <-> tutor DMs are untouched. Reversible: rows carry the backfill
  --    stamp (see the ops doc).
  with dm_pairs as (
    select c.id, c.org_id,
           min(cm.profile_id::text) filter (where p.kind = 'educator')::uuid as educator_id,
           min(cm.profile_id::text) filter (where p.kind in ('child', 'guardian'))::uuid as contact_id,
           count(*) as members
    from public.channels c
    join public.channel_members cm on cm.channel_id = c.id and cm.deleted_at is null
    join public.profiles p on p.id = cm.profile_id
    where c.kind = 'dm' and c.status = 'active' and c.deleted_at is null
    group by c.id, c.org_id
  )
  update public.channels c
     set status = 'archived', archived_at = public.learning_space_archive_backfill_stamp()
    from dm_pairs d
   where c.id = d.id
     and d.members = 2
     and d.educator_id is not null
     and d.contact_id is not null
     and not public.tutor_contact_has_active_class(d.org_id, d.educator_id, d.contact_id);
  get diagnostics v_orphans = row_count;
  raise notice 'learning space archive backfill: % unconnected tutor DMs archived', v_orphans;
end $backfill$;
