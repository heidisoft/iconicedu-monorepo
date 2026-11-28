begin;
create extension if not exists pgtap with schema extensions;
select plan(28);
insert into public.orgs(id,name,slug) values ('d1000000-0000-4000-8000-000000000001','Profile test','profile-settings-test');
insert into auth.users(id) values ('d2000000-0000-4000-8000-000000000001'),('d2000000-0000-4000-8000-000000000002');
insert into public.accounts(id,org_id,auth_user_id) values
('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001'),
('d3000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002'),
('d3000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001',null);
insert into public.profiles(id,org_id,account_id,kind,display_name,avatar_source) values
('d4000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','guardian','Parent','seed'),
('d4000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000002','educator','Tutor','seed'),
('d4000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000003','child','Student','seed');
insert into public.child_profiles(profile_id,org_id,birth_year) values ('d4000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001',2015);
insert into public.families(id,org_id,display_name) values ('d5000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Family');
insert into public.family_links(org_id,family_id,guardian_account_id,child_account_id,relation) values ('d1000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000003','guardian');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select lives_ok($$select public.save_profile_settings('d4000000-0000-4000-8000-000000000003', '{"first_name":"Student","last_name":"Test","display_name":"New name","ui_theme_key":"blue","timezone":"UTC","locale":"en-US","hide_role":true,"hide_status":true,"birth_year":2014,"grade_level":"grade_5","kind":"staff"}', 'd3000000-0000-4000-8000-000000000001')$$,'API can atomically save child presentation and school details');
reset role;
select is((select kind::text from public.profiles where id = 'd4000000-0000-4000-8000-000000000003'),'child','presentation update cannot change role');
select is((select birth_year from public.child_profiles where profile_id = 'd4000000-0000-4000-8000-000000000003'),2014,'child details saved');
select ok(exists(select 1 from public.profile_change_events where entity_id = 'd4000000-0000-4000-8000-000000000003' and operation = 'UPDATE' and actor_account_id = 'd3000000-0000-4000-8000-000000000001' and before_data->>'display_name' = 'Student' and after_data->>'display_name' = 'New name'),'API save records verified actor and before/after');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select lives_ok($$select public.save_profile_settings('d4000000-0000-4000-8000-000000000003','{"timezone":"Asia/Colombo","locale":"si-LK","languages_spoken":["English","Sinhala"]}','d3000000-0000-4000-8000-000000000001')$$,'section save accepts only regional fields');
reset role;
select is((select languages_spoken from public.profiles where id = 'd4000000-0000-4000-8000-000000000003'),array['English','Sinhala'],'regional section saves spoken languages');
select is((select display_name from public.profiles where id = 'd4000000-0000-4000-8000-000000000003'),'New name','regional edit preserves identity');
select ok((select hide_role and hide_status and ui_theme_key = 'blue' from public.profiles where id = 'd4000000-0000-4000-8000-000000000003'),'regional edit preserves appearance and visibility');
select is((select birth_year from public.child_profiles where profile_id = 'd4000000-0000-4000-8000-000000000003'),2014,'regional edit preserves child details');
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select ok(public.can_edit_family_profile('d4000000-0000-4000-8000-000000000001'),'can edit own guardian profile');
select ok(public.can_edit_family_profile('d4000000-0000-4000-8000-000000000003'),'guardian may edit linked child');
select ok(not public.can_edit_family_profile('d4000000-0000-4000-8000-000000000002'),'cannot edit another adult');
select is(public.get_profile_settings('d4000000-0000-4000-8000-000000000003')->>'canEdit','true','details include permissions');
select throws_ok($$select public.save_profile_settings('d4000000-0000-4000-8000-000000000003','{}','d3000000-0000-4000-8000-000000000001')$$,'42501',null,'client cannot bypass API validation');
select throws_ok($$select public.can_edit_family_profile_as('d4000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000001')$$,'42501',null,'users cannot query permissions as another actor');
select throws_ok($$delete from public.profile_change_events$$,'42501',null,'history is immutable for users');
reset role;
update public.family_links set permissions_scope = array['view'] where child_account_id = 'd3000000-0000-4000-8000-000000000003';
select ok(not public.can_edit_family_profile('d4000000-0000-4000-8000-000000000003'),'restricted link cannot edit');
select is(public.get_profile_settings('d4000000-0000-4000-8000-000000000003')->>'canEdit','false','restricted link can view details');
select throws_ok($$select public.remove_family_child('d4000000-0000-4000-8000-000000000003')$$,'42501',null,'restricted link cannot remove');
update public.family_links set permissions_scope = array['edit_profile'] where child_account_id = 'd3000000-0000-4000-8000-000000000003';
select ok(public.can_edit_family_profile('d4000000-0000-4000-8000-000000000003'),'explicit edit scope permits editing');
select throws_ok($$select public.remove_family_child('d4000000-0000-4000-8000-000000000003')$$,'42501',null,'edit permission alone cannot remove child');
update public.family_links set permissions_scope = array['manage_children'] where child_account_id = 'd3000000-0000-4000-8000-000000000003';
insert into public.learning_spaces(id,org_id,kind,title) values ('d6000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','one_on_one','Test class');
insert into public.learning_space_participants(org_id,learning_space_id,profile_id) values ('d1000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000003');
select throws_ok($$select public.remove_family_child('d4000000-0000-4000-8000-000000000003')$$,'23503',null,'assigned child cannot be removed');
select ok((select deleted_at is null from public.profiles where id = 'd4000000-0000-4000-8000-000000000003'),'blocked removal leaves profile unchanged');
update public.learning_space_participants set deleted_at = now() where profile_id = 'd4000000-0000-4000-8000-000000000003';
select lives_ok($$select public.remove_family_child('d4000000-0000-4000-8000-000000000003')$$,'unassigned child can be removed');
select ok((select deleted_at is not null from public.profiles where id = 'd4000000-0000-4000-8000-000000000003'),'removal soft deletes profile');
select ok((select deleted_at is not null from public.family_links where child_account_id = 'd3000000-0000-4000-8000-000000000003'),'removal soft deletes family link');
select ok(exists(select 1 from public.profile_change_events where entity_id = 'd4000000-0000-4000-8000-000000000003' and operation = 'UPDATE' and actor_account_id = 'd3000000-0000-4000-8000-000000000001' and after_data->>'deleted_at' is not null),'removal audit includes actor and history');
select throws_ok($$update public.learning_space_participants set deleted_at = null where profile_id = 'd4000000-0000-4000-8000-000000000003'$$,'23503',null,'removed child cannot be assigned again');
select * from finish();
rollback;
