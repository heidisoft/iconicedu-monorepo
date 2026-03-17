-- Patch support-channel visibility and write policies without editing prior migrations.
-- Safe to run after 042; uses create/replace + drop-if-exists patterns.

-- Normalize any pre-existing support channels to public for consistent UX.
update public.channels
set visibility = 'public',
    updated_at = now()
where purpose = 'support'
  and deleted_at is null
  and visibility <> 'public';

-- Enforce message visibility semantics while allowing support-staff historical visibility.
create or replace function public.can_access_message(_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.messages m
    join public.channels c on c.id = m.channel_id
    where m.id = _message_id
      and m.deleted_at is null
      and c.deleted_at is null
      and (
        (
          (
            public.is_channel_member(m.channel_id)
            or (
              c.purpose = 'support'
              and public.is_org_member(m.org_id)
            )
          )
          and (
            m.visibility_type = 'all'
            or (
              m.visibility_type = 'sender-only'
              and public.is_profile_owner(m.sender_profile_id)
            )
            or (
              m.visibility_type = 'recipient-only'
              and m.visibility_user_id is not null
              and exists (
                select 1
                from public.profiles vp
                where vp.id = m.visibility_user_id
                  and vp.account_id = public.current_account_id()
                  and vp.deleted_at is null
              )
            )
            or (
              m.visibility_type = 'specific-users'
              and exists (
                select 1
                from public.profiles vp
                where vp.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
                  and vp.account_id = public.current_account_id()
                  and vp.deleted_at is null
              )
            )
          )
        )
        or (
          c.purpose = 'support'
          and exists (
            select 1
            from public.accounts a
            left join public.user_roles ur
              on ur.org_id = a.org_id
             and ur.account_id = a.id
             and ur.role_key = 'staff'
             and ur.deleted_at is null
            left join public.profiles p
              on p.org_id = a.org_id
             and p.account_id = a.id
             and p.deleted_at is null
            where a.org_id = m.org_id
              and a.auth_user_id = auth.uid()
              and a.deleted_at is null
              and (
                ur.id is not null
                or p.kind = 'staff'
              )
          )
        )
      )
  );
$$;

drop policy if exists "messages select by member" on public.messages;
create policy "messages select by member"
  on public.messages for select
  using (deleted_at is null and public.can_access_message(id));

drop policy if exists "messages insert by member or system" on public.messages;
create policy "messages insert by member or system"
  on public.messages for insert
  with check (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        exists (
          select 1
          from public.channels c
          where c.id = channel_id
            and c.org_id = org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(org_id)
        )
      )
      or (
        auth.role() = 'service_role'
        and type in ('event-reminder', 'feedback-request', 'payment-reminder')
        and exists (
          select 1
          from public.profiles p
          where p.id = sender_profile_id
            and p.org_id = org_id
            and p.kind = 'system'
            and p.deleted_at is null
        )
      )
    )
  );

drop policy if exists "threads write by member" on public.threads;
create policy "threads write by member"
  on public.threads for all
  using (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        exists (
          select 1
          from public.channels c
          where c.id = channel_id
            and c.org_id = org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(org_id)
        )
      )
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        exists (
          select 1
          from public.channels c
          where c.id = channel_id
            and c.org_id = org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(org_id)
        )
      )
    )
  );

drop policy if exists "thread participants write by member" on public.thread_participants;
create policy "thread participants write by member"
  on public.thread_participants for all
  using (
    deleted_at is null
    and exists (
      select 1
      from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and (
          public.is_channel_member(t.channel_id)
          or (
            exists (
              select 1
              from public.channels c
              where c.id = t.channel_id
                and c.org_id = t.org_id
                and c.purpose = 'support'
                and c.deleted_at is null
                and public.is_org_member(t.org_id)
            )
          )
        )
    )
  )
  with check (
    deleted_at is null
    and exists (
      select 1
      from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and (
          public.is_channel_member(t.channel_id)
          or (
            exists (
              select 1
              from public.channels c
              where c.id = t.channel_id
                and c.org_id = t.org_id
                and c.purpose = 'support'
                and c.deleted_at is null
                and public.is_org_member(t.org_id)
            )
          )
        )
    )
  );

drop policy if exists "channel media all by member" on public.channel_media;
create policy "channel media all by member"
  on public.channel_media for all
  using (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        exists (
          select 1
          from public.channels c
          where c.id = channel_id
            and c.org_id = org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(org_id)
        )
      )
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        exists (
          select 1
          from public.channels c
          where c.id = channel_id
            and c.org_id = org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(org_id)
        )
      )
    )
  );

drop policy if exists "channel files all by member" on public.channel_files;
create policy "channel files all by member"
  on public.channel_files for all
  using (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        exists (
          select 1
          from public.channels c
          where c.id = channel_id
            and c.org_id = org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(org_id)
        )
      )
    )
  )
  with check (
    deleted_at is null
    and (
      public.is_channel_member(channel_id)
      or (
        exists (
          select 1
          from public.channels c
          where c.id = channel_id
            and c.org_id = org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(org_id)
        )
      )
    )
  );
