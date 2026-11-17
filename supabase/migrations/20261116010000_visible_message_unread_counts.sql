-- Keep channel unread state aligned with message RLS: an account must never
-- receive an unread increment for a message it cannot read. A later channel
-- unread migration replaced the earlier visibility-aware functions, so this
-- forward correction restores those predicates and repairs existing counts.

create or replace function public.increment_unread_for_channel_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_account_id uuid;
begin
  if new.deleted_at is not null or new.thread_parent_id is not null then
    return new;
  end if;

  select p.account_id
    into v_sender_account_id
    from public.profiles p
   where p.id = new.sender_profile_id
     and p.org_id = new.org_id
     and p.deleted_at is null
   limit 1;

  if v_sender_account_id is null then
    return new;
  end if;

  insert into public.channel_read_state (
    org_id,
    channel_id,
    thread_id,
    account_id,
    unread_count,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
  )
  select
    new.org_id,
    new.channel_id,
    null,
    recipient.account_id,
    1,
    now(),
    now(),
    null,
    null
  from (
    select distinct p.account_id
      from public.channel_members cm
      join public.profiles p
        on p.id = cm.profile_id
       and p.org_id = cm.org_id
       and p.deleted_at is null
     where cm.org_id = new.org_id
       and cm.channel_id = new.channel_id
       and cm.deleted_at is null
       and p.account_id is not null
       and p.account_id is distinct from v_sender_account_id
       and (
         new.visibility_type = 'all'
         or (
           new.visibility_type = 'recipient-only'
           and exists (
             select 1
               from public.profiles recipient_profile
              where recipient_profile.org_id = new.org_id
                and recipient_profile.id = new.visibility_user_id
                and recipient_profile.account_id = p.account_id
                and recipient_profile.deleted_at is null
           )
         )
         or (
           new.visibility_type = 'specific-users'
           and exists (
             select 1
               from public.profiles audience_profile
              where audience_profile.org_id = new.org_id
                and audience_profile.id = any(coalesce(new.visibility_user_ids, '{}'::uuid[]))
                and audience_profile.account_id = p.account_id
                and audience_profile.deleted_at is null
           )
         )
       )
  ) as recipient
  on conflict (org_id, channel_id, account_id, thread_id)
  do update
    set unread_count = greatest(0, coalesce(public.channel_read_state.unread_count, 0)) + 1,
        updated_at = now(),
        deleted_at = null,
        deleted_by = null;

  return new;
end;
$$;

create or replace function public.recompute_unread_for_account_channel(
  p_org_id uuid,
  p_channel_id uuid,
  p_account_id uuid,
  p_last_read_message_id uuid default null,
  p_last_read_at timestamptz default null,
  p_actor_profile_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effective_last_read_message_id uuid;
  v_effective_last_read_at timestamptz;
  v_unread integer;
begin
  if p_last_read_message_id is not null then
    select m.id, m.created_at
      into v_effective_last_read_message_id, v_effective_last_read_at
      from public.messages m
      left join public.profiles sender
        on sender.id = m.sender_profile_id
       and sender.org_id = m.org_id
       and sender.deleted_at is null
     where m.org_id = p_org_id
       and m.channel_id = p_channel_id
       and m.id = p_last_read_message_id
       and m.thread_parent_id is null
       and m.deleted_at is null
       and (
         m.visibility_type = 'all'
         or (m.visibility_type = 'sender-only' and sender.account_id = p_account_id)
         or (
           m.visibility_type = 'recipient-only'
           and exists (
             select 1 from public.profiles recipient_profile
              where recipient_profile.org_id = p_org_id
                and recipient_profile.id = m.visibility_user_id
                and recipient_profile.account_id = p_account_id
                and recipient_profile.deleted_at is null
           )
         )
         or (
           m.visibility_type = 'specific-users'
           and exists (
             select 1 from public.profiles audience_profile
              where audience_profile.org_id = p_org_id
                and audience_profile.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
                and audience_profile.account_id = p_account_id
                and audience_profile.deleted_at is null
           )
         )
       )
     limit 1;
  end if;

  if v_effective_last_read_message_id is null then
    select m.id, m.created_at
      into v_effective_last_read_message_id, v_effective_last_read_at
      from public.messages m
      left join public.profiles sender
        on sender.id = m.sender_profile_id
       and sender.org_id = m.org_id
       and sender.deleted_at is null
     where m.org_id = p_org_id
       and m.channel_id = p_channel_id
       and m.thread_parent_id is null
       and m.deleted_at is null
       and (
         m.visibility_type = 'all'
         or (m.visibility_type = 'sender-only' and sender.account_id = p_account_id)
         or (
           m.visibility_type = 'recipient-only'
           and exists (
             select 1 from public.profiles recipient_profile
              where recipient_profile.org_id = p_org_id
                and recipient_profile.id = m.visibility_user_id
                and recipient_profile.account_id = p_account_id
                and recipient_profile.deleted_at is null
           )
         )
         or (
           m.visibility_type = 'specific-users'
           and exists (
             select 1 from public.profiles audience_profile
              where audience_profile.org_id = p_org_id
                and audience_profile.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
                and audience_profile.account_id = p_account_id
                and audience_profile.deleted_at is null
           )
         )
       )
     order by m.created_at desc
     limit 1;
  end if;

  if v_effective_last_read_at is null then
    v_effective_last_read_at := coalesce(p_last_read_at, now());
  end if;

  select count(*)
    into v_unread
    from public.messages m
    join public.profiles sender
      on sender.id = m.sender_profile_id
     and sender.org_id = m.org_id
     and sender.deleted_at is null
   where m.org_id = p_org_id
     and m.channel_id = p_channel_id
     and m.thread_parent_id is null
     and m.deleted_at is null
     and m.created_at > v_effective_last_read_at
     and sender.account_id is distinct from p_account_id
     and (
       m.visibility_type = 'all'
       or (
         m.visibility_type = 'recipient-only'
         and exists (
           select 1 from public.profiles recipient_profile
            where recipient_profile.org_id = p_org_id
              and recipient_profile.id = m.visibility_user_id
              and recipient_profile.account_id = p_account_id
              and recipient_profile.deleted_at is null
         )
       )
       or (
         m.visibility_type = 'specific-users'
         and exists (
           select 1 from public.profiles audience_profile
            where audience_profile.org_id = p_org_id
              and audience_profile.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
              and audience_profile.account_id = p_account_id
              and audience_profile.deleted_at is null
         )
       )
     );

  insert into public.channel_read_state (
    org_id,
    channel_id,
    thread_id,
    account_id,
    last_read_message_id,
    last_read_at,
    unread_count,
    manually_marked_unread,
    manually_marked_unread_at,
    manually_marked_unread_from_message_id,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
  )
  values (
    p_org_id,
    p_channel_id,
    null,
    p_account_id,
    v_effective_last_read_message_id,
    v_effective_last_read_at,
    v_unread,
    false,
    null,
    null,
    now(),
    p_actor_profile_id,
    now(),
    p_actor_profile_id,
    null,
    null
  )
  on conflict (org_id, channel_id, account_id, thread_id)
  do update
    set last_read_message_id = excluded.last_read_message_id,
        last_read_at = excluded.last_read_at,
        unread_count = excluded.unread_count,
        manually_marked_unread = false,
        manually_marked_unread_at = null,
        manually_marked_unread_from_message_id = null,
        updated_at = now(),
        updated_by = excluded.updated_by,
        deleted_at = null,
        deleted_by = null;

  return v_unread;
end;
$$;

-- Repair existing channel-level rows without changing the user's read cursor.
update public.channel_read_state crs
   set unread_count = (
         select count(*)
           from public.messages m
           join public.profiles sender
             on sender.id = m.sender_profile_id
            and sender.org_id = m.org_id
            and sender.deleted_at is null
          where m.org_id = crs.org_id
            and m.channel_id = crs.channel_id
            and m.thread_parent_id is null
            and m.deleted_at is null
            and m.created_at > coalesce(crs.last_read_at, '-infinity'::timestamptz)
            and sender.account_id is distinct from crs.account_id
            and (
              m.visibility_type = 'all'
              or (
                m.visibility_type = 'recipient-only'
                and exists (
                  select 1 from public.profiles recipient_profile
                   where recipient_profile.org_id = crs.org_id
                     and recipient_profile.id = m.visibility_user_id
                     and recipient_profile.account_id = crs.account_id
                     and recipient_profile.deleted_at is null
                )
              )
              or (
                m.visibility_type = 'specific-users'
                and exists (
                  select 1 from public.profiles audience_profile
                   where audience_profile.org_id = crs.org_id
                     and audience_profile.id = any(coalesce(m.visibility_user_ids, '{}'::uuid[]))
                     and audience_profile.account_id = crs.account_id
                     and audience_profile.deleted_at is null
                )
              )
            )
       ),
       updated_at = now()
 where crs.thread_id is null
   and crs.deleted_at is null;
