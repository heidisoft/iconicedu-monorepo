-- Keep restricted channel-message audiences immutable and make every thread
-- reply inherit the exact visibility of its parent. This protects all writers,
-- including service-role and future background jobs, rather than relying on UI.

create or replace function public.enforce_message_audience_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent public.messages%rowtype;
begin
  if tg_op = 'UPDATE' and (
    new.visibility_type is distinct from old.visibility_type
    or new.visibility_user_id is distinct from old.visibility_user_id
    or new.visibility_user_ids is distinct from old.visibility_user_ids
  ) then
    raise exception 'message audience is immutable' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' and new.thread_parent_id is not null then
    select * into v_parent
      from public.messages
     where id = new.thread_parent_id
       and org_id = new.org_id
       and channel_id = new.channel_id
       and deleted_at is null;

    if not found then
      raise exception 'thread parent message was not found' using errcode = '23503';
    end if;

    new.visibility_type := v_parent.visibility_type;
    new.visibility_user_id := v_parent.visibility_user_id;
    new.visibility_user_ids := v_parent.visibility_user_ids;
  elsif tg_op = 'INSERT' and new.reply_to_message_id is not null then
    select * into v_parent
      from public.messages
     where id = new.reply_to_message_id
       and org_id = new.org_id
       and channel_id = new.channel_id
       and deleted_at is null;

    if not found then
      raise exception 'referenced message was not found' using errcode = '23503';
    end if;

    -- A quote/reply to a restricted message must never expose that message's
    -- preview to a wider audience. Public replies may still choose an audience.
    if v_parent.visibility_type = 'specific-users' then
      new.visibility_type := v_parent.visibility_type;
      new.visibility_user_id := v_parent.visibility_user_id;
      new.visibility_user_ids := v_parent.visibility_user_ids;
    end if;
  end if;

  if new.visibility_type = 'specific-users' then
    if coalesce(cardinality(new.visibility_user_ids), 0) = 0 then
      raise exception 'specific-users audience cannot be empty' using errcode = '22023';
    end if;
    if not (new.sender_profile_id = any(new.visibility_user_ids)) then
      raise exception 'message sender must belong to the audience' using errcode = '22023';
    end if;
    new.visibility_user_id := null;
  elsif new.visibility_type = 'all' then
    new.visibility_user_id := null;
    new.visibility_user_ids := null;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_audience_integrity on public.messages;
create trigger messages_audience_integrity
before insert or update of visibility_type, visibility_user_id, visibility_user_ids
on public.messages
for each row execute function public.enforce_message_audience_integrity();

revoke all on function public.enforce_message_audience_integrity() from public;
