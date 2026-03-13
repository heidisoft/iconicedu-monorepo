-- ---------------------------------------------------------------------------
-- Widen schedule SELECT visibility for learning-space participants
--
-- Problem:
--   Schedule SELECT policies only allowed direct schedule participants
--   (class_schedule_participants) or schedule managers.
--
-- Goal:
--   Any learning-space participant can read schedules for that learning space,
--   while preserving existing manager access and not broadening non-class-session
--   schedule visibility.
-- ---------------------------------------------------------------------------

-- class_schedules -------------------------------------------------------------
drop policy if exists "class schedules select by participant or manager" on public.class_schedules;

create policy "class schedules select by participant or manager"
  on public.class_schedules for select
  using (
    deleted_at is null
    and (
      public.is_schedule_participant(id)
      or public.can_manage_schedule(id)
      or (
        source_kind = 'class_session'
        and source_learning_space_id is not null
        and public.is_learning_space_participant(source_learning_space_id)
      )
    )
  );

-- class_schedule_participants -------------------------------------------------
drop policy if exists "schedule participants select by participant or manager" on public.class_schedule_participants;

create policy "schedule participants select by participant or manager"
  on public.class_schedule_participants for select
  using (
    deleted_at is null
    and (
      public.is_schedule_participant(schedule_id)
      or public.can_manage_schedule(schedule_id)
      or exists (
        select 1
        from public.class_schedules cs
        where cs.id = schedule_id
          and cs.deleted_at is null
          and cs.source_kind = 'class_session'
          and cs.source_learning_space_id is not null
          and public.is_learning_space_participant(cs.source_learning_space_id)
      )
    )
  );

-- class_schedule_recurrence ---------------------------------------------------
drop policy if exists "schedule recurrence select by participant or manager" on public.class_schedule_recurrence;

create policy "schedule recurrence select by participant or manager"
  on public.class_schedule_recurrence for select
  using (
    deleted_at is null
    and (
      public.is_schedule_participant(schedule_id)
      or public.can_manage_schedule(schedule_id)
      or exists (
        select 1
        from public.class_schedules cs
        where cs.id = schedule_id
          and cs.deleted_at is null
          and cs.source_kind = 'class_session'
          and cs.source_learning_space_id is not null
          and public.is_learning_space_participant(cs.source_learning_space_id)
      )
    )
  );

-- class_schedule_recurrence_exceptions ---------------------------------------
drop policy if exists "schedule exceptions select by participant or manager" on public.class_schedule_recurrence_exceptions;

create policy "schedule exceptions select by participant or manager"
  on public.class_schedule_recurrence_exceptions for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.class_schedule_recurrence cr
      join public.class_schedules cs on cs.id = cr.schedule_id
      where cr.id = recurrence_id
        and cr.deleted_at is null
        and cs.deleted_at is null
        and (
          public.is_schedule_participant(cr.schedule_id)
          or public.can_manage_schedule(cr.schedule_id)
          or (
            cs.source_kind = 'class_session'
            and cs.source_learning_space_id is not null
            and public.is_learning_space_participant(cs.source_learning_space_id)
          )
        )
    )
  );

-- class_schedule_recurrence_overrides ----------------------------------------
drop policy if exists "schedule overrides select by participant or manager" on public.class_schedule_recurrence_overrides;

create policy "schedule overrides select by participant or manager"
  on public.class_schedule_recurrence_overrides for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.class_schedule_recurrence cr
      join public.class_schedules cs on cs.id = cr.schedule_id
      where cr.id = recurrence_id
        and cr.deleted_at is null
        and cs.deleted_at is null
        and (
          public.is_schedule_participant(cr.schedule_id)
          or public.can_manage_schedule(cr.schedule_id)
          or (
            cs.source_kind = 'class_session'
            and cs.source_learning_space_id is not null
            and public.is_learning_space_participant(cs.source_learning_space_id)
          )
        )
    )
  );
