-- Channel unread counts must follow message visibility: an account is never
-- told about (or anchored to) a message it cannot read.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Org with a sender (S), two channel members (A, B) and one org profile that is
-- not a channel member (C).
insert into public.orgs(id, name, slug)
values ('b1000000-0000-4000-8000-000000000001', 'Visible unread test', 'visible-unread-test');
insert into auth.users(id) values
  ('b2000000-0000-4000-8000-00000000000a'),
  ('b2000000-0000-4000-8000-00000000000b'),
  ('b2000000-0000-4000-8000-00000000000c'),
  ('b2000000-0000-4000-8000-00000000000d');
insert into public.accounts(id, org_id, auth_user_id) values
  ('b3000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000a'),
  ('b3000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000b'),
  ('b3000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000c'),
  ('b3000000-0000-4000-8000-00000000000d', 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000d');
-- Profile suffixes: ...0a = S (sender), ...0b = A, ...0c = B, ...0d = C (non-member).
insert into public.profiles(id, org_id, account_id, kind, display_name, avatar_source, timezone) values
  ('b4000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000a', 'educator', 'Sender', 'seed', 'UTC'),
  ('b4000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000b', 'child', 'Member A', 'seed', 'UTC'),
  ('b4000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000c', 'child', 'Member B', 'seed', 'UTC'),
  ('b4000000-0000-4000-8000-00000000000d', 'b1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000d', 'educator', 'Non-member C', 'seed', 'UTC');
insert into public.channels(id, org_id, kind, topic, visibility, purpose) values
  ('b5000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'channel', 'Classroom', 'private', 'learning-space');
insert into public.channel_members(id, org_id, channel_id, profile_id) values
  ('b7000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000a'),
  ('b7000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000b'),
  ('b7000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000c');

create temporary table unread_of(label text primary key, account_id uuid) on commit drop;
insert into unread_of values
  ('S', 'b3000000-0000-4000-8000-00000000000a'),
  ('A', 'b3000000-0000-4000-8000-00000000000b'),
  ('B', 'b3000000-0000-4000-8000-00000000000c'),
  ('C', 'b3000000-0000-4000-8000-00000000000d');

create function pg_temp.unread(p_label text) returns integer language sql as $$
  select coalesce((select crs.unread_count
    from public.channel_read_state crs
    join unread_of u on u.account_id = crs.account_id
   where u.label = p_label
     and crs.channel_id = 'b5000000-0000-4000-8000-000000000001'
     and crs.thread_id is null
     and crs.deleted_at is null), 0)
$$;

-- ---------------------------------------------------------------------------
-- Insert trigger: increment_unread_for_channel_members
-- ---------------------------------------------------------------------------

-- M1: everyone.
insert into public.messages(id, org_id, channel_id, sender_profile_id, type, visibility_type, created_at)
values ('b6000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000a', 'text', 'all', '2026-01-01 10:01:00+00');
select is(pg_temp.unread('A'), 1, 'Everyone message increments member A');
select is(pg_temp.unread('B'), 1, 'Everyone message increments member B');
select is(pg_temp.unread('S'), 0, 'Sender is never incremented for their own message');

-- M2: recipient-only to A.
insert into public.messages(id, org_id, channel_id, sender_profile_id, type, visibility_type, visibility_user_id, created_at)
values ('b6000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000a', 'text', 'recipient-only', 'b4000000-0000-4000-8000-00000000000b', '2026-01-01 10:02:00+00');
select is(pg_temp.unread('A'), 2, 'Recipient-only message increments its recipient');
select is(pg_temp.unread('B'), 1, 'Recipient-only message does not increment other members');

-- M3: specific users S + B.
insert into public.messages(id, org_id, channel_id, sender_profile_id, type, visibility_type, visibility_user_ids, created_at)
values ('b6000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000a', 'text', 'specific-users', array['b4000000-0000-4000-8000-00000000000a', 'b4000000-0000-4000-8000-00000000000c']::uuid[], '2026-01-01 10:03:00+00');
select is(pg_temp.unread('B'), 2, 'Specific-users message increments a selected member');
select is(pg_temp.unread('A'), 2, 'Specific-users message does not increment an unselected member');
select is(pg_temp.unread('S'), 0, 'Sender in the selected audience is still not incremented');

-- M4: sender-only.
insert into public.messages(id, org_id, channel_id, sender_profile_id, type, visibility_type, created_at)
values ('b6000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000a', 'text', 'sender-only', '2026-01-01 10:04:00+00');
select ok(pg_temp.unread('A') = 2 and pg_temp.unread('B') = 2, 'Sender-only message increments nobody');

-- M5: thread reply visible to everyone.
insert into public.messages(id, org_id, channel_id, sender_profile_id, type, thread_parent_id, visibility_type, created_at)
values ('b6000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000a', 'text', 'b6000000-0000-4000-8000-000000000001', 'all', '2026-01-01 10:05:00+00');
select ok(pg_temp.unread('A') = 2 and pg_temp.unread('B') = 2, 'Thread replies do not change channel-level unread counts');

-- M6: inserted already soft-deleted.
insert into public.messages(id, org_id, channel_id, sender_profile_id, type, visibility_type, created_at, deleted_at)
values ('b6000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000a', 'text', 'all', '2026-01-01 10:06:00+00', '2026-01-01 10:06:00+00');
select ok(pg_temp.unread('A') = 2 and pg_temp.unread('B') = 2, 'Deleted messages do not increment unread counts');

-- M7: specific users naming the sender plus a profile that is not a channel member.
insert into public.messages(id, org_id, channel_id, sender_profile_id, type, visibility_type, visibility_user_ids, created_at)
values ('b6000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-00000000000a', 'text', 'specific-users', array['b4000000-0000-4000-8000-00000000000a', 'b4000000-0000-4000-8000-00000000000d']::uuid[], '2026-01-01 10:07:00+00');
select ok(not exists (select 1 from public.channel_read_state where account_id = 'b3000000-0000-4000-8000-00000000000d' and channel_id = 'b5000000-0000-4000-8000-000000000001'), 'Audience profiles outside the channel never get channel unread rows');
select ok(pg_temp.unread('A') = 2 and pg_temp.unread('B') = 2, 'Non-member audience does not leak increments to members');

-- ---------------------------------------------------------------------------
-- recompute_unread_for_account_channel
-- Visible timelines:  A -> M1, M2      B -> M1, M3      S -> M1, M3, M4, M7
-- ---------------------------------------------------------------------------

select is(
  public.recompute_unread_for_account_channel('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000b', 'b6000000-0000-4000-8000-000000000001'),
  1,
  'Recompute counts only visible messages after the cursor (A: M2)'
);
select is(
  public.recompute_unread_for_account_channel('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000c', 'b6000000-0000-4000-8000-000000000001'),
  1,
  'Recompute counts only visible messages after the cursor (B: M3)'
);
select is(
  public.recompute_unread_for_account_channel('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000a', 'b6000000-0000-4000-8000-000000000001'),
  0,
  'Recompute excludes the account''s own messages, including sender-only ones'
);

-- A cursor naming a message the account cannot read must not be adopted.
select is(
  public.recompute_unread_for_account_channel('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000c', 'b6000000-0000-4000-8000-000000000002'),
  0,
  'Hidden cursor falls back to the latest visible message'
);
select is(
  (select last_read_message_id from public.channel_read_state where account_id = 'b3000000-0000-4000-8000-00000000000c' and channel_id = 'b5000000-0000-4000-8000-000000000001' and thread_id is null),
  'b6000000-0000-4000-8000-000000000003'::uuid,
  'Hidden cursor is replaced by the latest message B can read (M3)'
);

-- No cursor: anchor to the latest visible top-level message, ignoring later hidden ones.
select is(
  public.recompute_unread_for_account_channel('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000b'),
  0,
  'Later hidden messages do not count as unread after a full read'
);
select is(
  (select last_read_message_id from public.channel_read_state where account_id = 'b3000000-0000-4000-8000-00000000000b' and channel_id = 'b5000000-0000-4000-8000-000000000001' and thread_id is null),
  'b6000000-0000-4000-8000-000000000002'::uuid,
  'Full read anchors A to its latest visible message (M2), not hidden M3/M7'
);

-- Thread replies are never channel cursors.
select lives_ok(
  $$select public.recompute_unread_for_account_channel('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000b', 'b6000000-0000-4000-8000-000000000005')$$,
  'Recompute accepts a thread reply as cursor'
);
select is(
  (select last_read_message_id from public.channel_read_state where account_id = 'b3000000-0000-4000-8000-00000000000b' and channel_id = 'b5000000-0000-4000-8000-000000000001' and thread_id is null),
  'b6000000-0000-4000-8000-000000000002'::uuid,
  'Thread reply cursor falls back to the latest visible top-level message'
);

-- The sender's own sender-only note is a valid cursor for the sender.
select public.recompute_unread_for_account_channel('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000a', 'b6000000-0000-4000-8000-000000000004');
select is(
  (select last_read_message_id from public.channel_read_state where account_id = 'b3000000-0000-4000-8000-00000000000a' and channel_id = 'b5000000-0000-4000-8000-000000000001' and thread_id is null),
  'b6000000-0000-4000-8000-000000000004'::uuid,
  'Sender-only message is a valid cursor for its sender'
);

-- Recompute is the "user read the channel" signal and clears manual unread.
select public.mark_channel_unread('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000b', null, 'b6000000-0000-4000-8000-000000000002');
select public.recompute_unread_for_account_channel('b1000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-00000000000b');
select ok(
  (select not manually_marked_unread and manually_marked_unread_from_message_id is null from public.channel_read_state where account_id = 'b3000000-0000-4000-8000-00000000000b' and channel_id = 'b5000000-0000-4000-8000-000000000001' and thread_id is null),
  'Recompute clears the manual-unread flag and anchor'
);

select * from finish();
rollback;
