-- Staff (owners, admins, staff) can read every restricted channel message in
-- channels they can see, but cannot reply, react, or create threads on
-- messages whose audience they are not part of.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Suffixes: 01 staff member, 02 staff observer (not a member), 03 tutor
-- member (not staff, not in audience), 04 owner (educator profile + owner
-- role, member), 05 tutor sender, 06 parent recipient.
insert into public.orgs(id, name, slug)
values ('c1000000-0000-4000-8000-000000000001', 'Staff review test', 'staff-review-test');
insert into auth.users(id)
select ('c2000000-0000-4000-8000-0000000000' || n)::uuid from unnest(array['01','02','03','04','05','06']) n;
insert into public.accounts(id, org_id, auth_user_id)
select ('c3000000-0000-4000-8000-0000000000' || n)::uuid, 'c1000000-0000-4000-8000-000000000001', ('c2000000-0000-4000-8000-0000000000' || n)::uuid
  from unnest(array['01','02','03','04','05','06']) n;
insert into public.profiles(id, org_id, account_id, kind, display_name, avatar_source, timezone) values
  ('c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'staff', 'Staff member', 'seed', 'UTC'),
  ('c4000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000002', 'staff', 'Staff observer', 'seed', 'UTC'),
  ('c4000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000003', 'educator', 'Other tutor', 'seed', 'UTC'),
  ('c4000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000004', 'educator', 'Owner', 'seed', 'UTC'),
  ('c4000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000005', 'educator', 'Tutor sender', 'seed', 'UTC'),
  ('c4000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000006', 'guardian', 'Parent', 'seed', 'UTC');
insert into public.user_roles(org_id, account_id, role_key)
values ('c1000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000004', 'owner');
insert into public.channels(id, org_id, kind, topic, visibility, purpose) values
  ('c5000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'channel', 'Classroom', 'private', 'learning-space');
insert into public.channel_members(org_id, channel_id, profile_id)
select 'c1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', ('c4000000-0000-4000-8000-0000000000' || n)::uuid
  from unnest(array['01','03','04','05','06']) n;

-- R: tutor -> parent private message with text and an attachment.
insert into public.messages(id, org_id, channel_id, sender_profile_id, type, visibility_type, visibility_user_ids)
values ('c6000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000005', 'text', 'specific-users',
        array['c4000000-0000-4000-8000-000000000005', 'c4000000-0000-4000-8000-000000000006']::uuid[]);
insert into public.message_text(message_id, org_id, payload)
values ('c6000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '{"text":"He was unwell this week"}');
insert into public.channel_files(org_id, channel_id, message_id, kind, url, name)
values ('c1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'file', 'c1000000/c5000000/files/private-note.pdf', 'note.pdf');
insert into public.threads(id, org_id, channel_id, parent_message_id)
values ('c7000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001');

create function pg_temp.sign_in(p_suffix text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', 'c2000000-0000-4000-8000-0000000000' || p_suffix, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff member of the channel, outside the audience.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('01');
select is((select count(*)::int from public.messages where id = 'c6000000-0000-4000-8000-000000000001'), 1, 'Staff member can read a private message they are not part of');
select is((select payload ->> 'text' from public.message_text where message_id = 'c6000000-0000-4000-8000-000000000001'), 'He was unwell this week', 'Staff member can read its content');
select is((select count(*)::int from public.threads where id = 'c7000000-0000-4000-8000-000000000001'), 1, 'Staff member can read its thread');
select ok(public.can_access_channel_file_object('c1000000/c5000000/files/private-note.pdf'), 'Staff member can download its attachment');
select throws_ok(
  $$insert into public.message_reactions(org_id, message_id, account_id, emoji) values ('c1000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', '👍')$$,
  '42501', null, 'Staff member cannot react to it'
);
select throws_ok(
  $$insert into public.threads(org_id, channel_id, parent_message_id) values ('c1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'Staff member cannot create thread metadata on it'
);
select throws_ok(
  $$insert into public.messages(org_id, channel_id, sender_profile_id, type, thread_parent_id, visibility_type) values ('c1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'text', 'c6000000-0000-4000-8000-000000000001', 'all')$$,
  null, null, 'Staff member cannot reply in its thread'
);
update public.message_text set payload = '{"text":"edited"}' where message_id = 'c6000000-0000-4000-8000-000000000001';
select is((select payload ->> 'text' from public.message_text where message_id = 'c6000000-0000-4000-8000-000000000001'), 'He was unwell this week', 'Staff member cannot edit its content');
reset role;

-- ---------------------------------------------------------------------------
-- Other roles.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('02');
select is((select count(*)::int from public.messages where id = 'c6000000-0000-4000-8000-000000000001'), 1, 'Staff observer (not a member) can read it');
reset role;

select pg_temp.sign_in('04');
select is((select count(*)::int from public.messages where id = 'c6000000-0000-4000-8000-000000000001'), 1, 'Owner role counts as staff for review');
reset role;

select pg_temp.sign_in('03');
select is((select count(*)::int from public.messages where id = 'c6000000-0000-4000-8000-000000000001'), 0, 'Non-staff member outside the audience cannot read it');
select is((select count(*)::int from public.message_text where message_id = 'c6000000-0000-4000-8000-000000000001'), 0, 'Non-staff member cannot read its content');
select is((select count(*)::int from public.threads where id = 'c7000000-0000-4000-8000-000000000001'), 0, 'Non-staff member cannot read its thread');
select ok(not public.can_access_channel_file_object('c1000000/c5000000/files/private-note.pdf'), 'Non-staff member cannot download its attachment');
reset role;

select pg_temp.sign_in('06');
select is((select count(*)::int from public.messages where id = 'c6000000-0000-4000-8000-000000000001'), 1, 'Audience member still reads it');
select lives_ok(
  $$insert into public.message_reactions(org_id, message_id, account_id, emoji) values ('c1000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000006', '👍')$$,
  'Audience member can still react'
);
reset role;

select * from finish();
rollback;
