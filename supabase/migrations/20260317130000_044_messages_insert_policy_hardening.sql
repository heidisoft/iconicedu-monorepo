-- Harden messages INSERT authorization without relying on app-level fallback.
-- This migration is forward-only and does not modify prior migration files.

create or replace function public.can_insert_message(
  _org_id uuid,
  _channel_id uuid,
  _sender_profile_id uuid,
  _type public.message_type
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      auth.role() = 'service_role'
      and _type in ('event-reminder', 'feedback-request', 'payment-reminder')
      and exists (
        select 1
        from public.profiles p
        where p.id = _sender_profile_id
          and p.org_id = _org_id
          and p.kind = 'system'
          and p.deleted_at is null
      )
    )
    or
    (
      exists (
        select 1
        from public.profiles p
        join public.accounts a on a.id = p.account_id
        where p.id = _sender_profile_id
          and p.org_id = _org_id
          and a.auth_user_id = auth.uid()
          and p.deleted_at is null
          and a.deleted_at is null
      )
      and (
        public.is_channel_member(_channel_id)
        or exists (
          select 1
          from public.channels c
          where c.id = _channel_id
            and c.org_id = _org_id
            and c.purpose = 'support'
            and c.deleted_at is null
            and public.is_org_member(_org_id)
        )
      )
    );
$$;

drop policy if exists "messages insert by member or system" on public.messages;
create policy "messages insert by member or system"
  on public.messages
  for insert
  with check (
    deleted_at is null
    and public.can_insert_message(org_id, channel_id, sender_profile_id, type)
  );
