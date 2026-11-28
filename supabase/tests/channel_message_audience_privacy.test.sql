begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_function('public', 'can_access_thread', array['uuid'], 'Thread access follows its parent message');
select has_function('public', 'can_access_channel_file_object', array['text'], 'Storage access follows message audience');
select policies_are('public', 'threads', array[
  'threads delete by parent audience',
  'threads insert by parent audience',
  'threads select by parent audience',
  'threads select staff review',
  'threads update by parent audience'
], 'Thread metadata has only audience-aware and read-only staff review policies');
select policies_are('public', 'channel_media', array[
  'channel media delete by message audience',
  'channel media insert by message audience',
  'channel media select by message audience',
  'channel_media select staff review',
  'channel media update by message audience'
], 'Media metadata has only audience-aware and read-only staff review policies');
select policies_are('public', 'channel_files', array[
  'channel files delete by message audience',
  'channel files insert by message audience',
  'channel files select by message audience',
  'channel_files select staff review',
  'channel files update by message audience'
], 'File metadata has only audience-aware and read-only staff review policies');

insert into public.orgs(id, name, slug)
values ('a1000000-0000-4000-8000-000000000001', 'Audience privacy test', 'audience-privacy-test');
insert into auth.users(id) values
  ('a2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002'),
  ('a2000000-0000-4000-8000-000000000003');
insert into public.accounts(id, org_id, auth_user_id) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003');
insert into public.profiles(id, org_id, account_id, kind, display_name, avatar_source, timezone) values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'educator', 'Original staff', 'seed', 'UTC'),
  ('a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'child', 'Student', 'seed', 'UTC'),
  ('a4000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003', 'educator', 'New staff', 'seed', 'UTC');
insert into public.channels(id, org_id, kind, topic, visibility, purpose) values
  ('a5000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'channel', 'Support', 'private', 'support'),
  ('a5000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'channel', 'Classroom', 'private', 'learning-space');

insert into public.channel_members(id, org_id, channel_id, profile_id) values
  ('a7000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001'),
  ('a7000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002'),
  ('a7000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000003');

insert into public.messages(id, org_id, channel_id, sender_profile_id, type, visibility_type, visibility_user_ids)
values
  ('a6000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'text', 'specific-users', array['a4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000002']::uuid[]),
  ('a6000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 'text', 'specific-users', array['a4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000002']::uuid[]);

insert into public.messages(id, org_id, channel_id, sender_profile_id, type, thread_parent_id, visibility_type, visibility_user_ids)
values
  ('a6000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000003', 'text', 'a6000000-0000-4000-8000-000000000001', 'specific-users', array['a4000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000003']::uuid[]),
  ('a6000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 'text', 'a6000000-0000-4000-8000-000000000002', 'all', null);

select is((select visibility_type::text from public.messages where id = 'a6000000-0000-4000-8000-000000000003'), 'specific-users', 'Support reply keeps its recalculated audience');
select ok((select 'a4000000-0000-4000-8000-000000000003'::uuid = any(visibility_user_ids) from public.messages where id = 'a6000000-0000-4000-8000-000000000003'), 'New support staff remains in reply audience');
select ok((select not ('a4000000-0000-4000-8000-000000000001'::uuid = any(visibility_user_ids)) from public.messages where id = 'a6000000-0000-4000-8000-000000000003'), 'Support reply does not inherit stale staff audience');
select is((select visibility_type::text from public.messages where id = 'a6000000-0000-4000-8000-000000000004'), 'specific-users', 'Non-support thread reply inherits parent visibility');
select is((select visibility_user_ids from public.messages where id = 'a6000000-0000-4000-8000-000000000004'), array['a4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000002']::uuid[], 'Non-support thread reply inherits parent audience');
select is(
  (select unread_count from public.channel_read_state where channel_id = 'a5000000-0000-4000-8000-000000000002' and account_id = 'a3000000-0000-4000-8000-000000000002' and thread_id is null),
  1,
  'Visible restricted channel message increments unread count'
);
select is(
  (select unread_count from public.channel_read_state where channel_id = 'a5000000-0000-4000-8000-000000000002' and account_id = 'a3000000-0000-4000-8000-000000000003' and thread_id is null),
  0,
  'Hidden restricted channel message does not increment unread count'
);

select * from finish();
rollback;
