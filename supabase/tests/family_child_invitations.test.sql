begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into public.orgs(id,name,slug) values ('e1000000-0000-4000-8000-000000000001','Invite test','invite-test'),('e1000000-0000-4000-8000-000000000002','Other org','invite-test-other');
insert into auth.users(id,email,email_confirmed_at) values ('e2000000-0000-4000-8000-000000000001','family-test-parent@example.invalid',now());
insert into public.accounts(id,org_id,auth_user_id,email,primary_role,status) values
('e3000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','family-test-parent@example.invalid','guardian','active'),
('e3000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001',null,'family-test-parent2@example.invalid','guardian','active'),
('e3000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000001',null,'family-test-teacher@example.invalid','educator','active'),
('e3000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000001',null,null,null,'active'),
('e3000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000001',null,null,null,'active'),
('e3000000-0000-4000-8000-000000000006','e1000000-0000-4000-8000-000000000002',null,null,null,'active');
insert into public.profiles(id,org_id,account_id,kind,display_name,first_name,last_name,avatar_source,ui_theme_key) values
('e4000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','guardian','Parent','Parent','Test','seed','green'),
('e4000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002','guardian','Parent2','Parent','Two','seed','green'),
('e4000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000003','educator','Teacher','Teacher','Test','seed','green'),
('e4000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000004','child','Original child','Original','Child','seed','blue'),
('e4000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000005','child','Restricted','Restricted','Child','seed','blue'),
('e4000000-0000-4000-8000-000000000006','e1000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000006','child','Other org child','Other','Child','seed','blue');
insert into public.families(id,org_id,display_name,created_by) values ('e5000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Family','e3000000-0000-4000-8000-000000000001');
insert into public.family_links(org_id,family_id,guardian_account_id,child_account_id,relation,permissions_scope) values
('e1000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000004','guardian',null),
('e1000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000005','guardian',array['view']);
select set_config('request.jwt.claims','{"sub":"e2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','new@example.invalid')$$,'42501',null,'clients cannot forge an actor by calling prepare directly');
select throws_ok($$select public.revoke_family_child_invite('e3000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001')$$,'42501',null,'clients cannot forge invitation revocation actors');
select is(public.get_profile_settings('e4000000-0000-4000-8000-000000000004')->>'canInvite','true','managed child supports sign-in invitation');
select is(public.get_profile_settings('e4000000-0000-4000-8000-000000000005')->>'canInvite','false','restricted child does not expose invitation action');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000003','teacher-child@example.invalid')$$,'42501',null,'educators cannot send guardian invitations');
select throws_ok($$select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','family-test-parent@example.invalid')$$,'22023',null,'parent cannot invite their own email');
select throws_ok($$select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','other@example.invalid','e4000000-0000-4000-8000-000000000006')$$,'42501',null,'cross-org targets are forbidden');
select throws_ok($$select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','restricted@example.invalid','e4000000-0000-4000-8000-000000000005')$$,'42501',null,'view-only family links cannot assign child email');
update public.accounts set email = 'family-test-restricted@example.invalid' where id = 'e3000000-0000-4000-8000-000000000005';
select throws_ok($$select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','family-test-restricted@example.invalid')$$,'42501',null,'standalone invitations cannot bypass restricted family link permissions');
create temp table managed as select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001',' FAMILY-TEST-MANAGED@example.invalid ','e4000000-0000-4000-8000-000000000004') as payload;
select is((select email from public.accounts where id = 'e3000000-0000-4000-8000-000000000004'),'family-test-managed@example.invalid','managed child email is normalized');
select ok((select display_name = 'Original child' and first_name = 'Original' and ui_theme_key = 'blue' from public.profiles where id = 'e4000000-0000-4000-8000-000000000004'),'invitation preserves profile identity and accent');
select ok(exists(select 1 from public.profile_change_events where entity_table = 'accounts' and entity_id = 'e3000000-0000-4000-8000-000000000004' and actor_account_id = 'e3000000-0000-4000-8000-000000000001' and after_data->>'email' = 'family-test-managed@example.invalid'),'email assignment has actor-attributed audit history');
select throws_ok($$select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','family-test-managed@example.invalid')$$,'23505',null,'duplicate pending invitations are rejected');
create temp table fresh as select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','family-test-fresh@example.invalid') as payload;
select is((select payload->>'orgSlug' from fresh),'invite-test','invitation callback uses actor organization');
select ok(not exists(select 1 from public.family_links where child_account_id = (select account_id from public.profiles where id = (select (payload->>'profileId')::uuid from fresh))),'inviting by email does not link the child before acceptance');
select ok(exists(select 1 from public.profile_change_events where entity_table = 'family_link_invites' and entity_id = (select (payload->'invite'->>'id')::uuid from fresh) and actor_account_id = 'e3000000-0000-4000-8000-000000000001'),'invitation creation is audited');
insert into auth.users(id,email,email_confirmed_at) values ('e2000000-0000-4000-8000-000000000007','family-test-fresh@example.invalid',now());
update public.accounts set auth_user_id = 'e2000000-0000-4000-8000-000000000007' where email = 'family-test-fresh@example.invalid';
select throws_ok($$update public.family_link_invites set status = 'accepted', accepted_by_account_id = 'e3000000-0000-4000-8000-000000000001' where id = (select (payload->'invite'->>'id')::uuid from fresh)$$,'42501',null,'a different verified user cannot accept the invitation');
select lives_ok($$update public.family_link_invites set status = 'accepted', accepted_by_account_id = (select id from public.accounts where email = 'family-test-fresh@example.invalid') where id = (select (payload->'invite'->>'id')::uuid from fresh)$$,'verified child can accept the shared invitation');
select ok(exists(select 1 from public.family_links where guardian_account_id = 'e3000000-0000-4000-8000-000000000001' and child_account_id = (select id from public.accounts where email = 'family-test-fresh@example.invalid')),'acceptance links the child atomically');
select is((select uses from public.family_link_invites where id = (select (payload->'invite'->>'id')::uuid from fresh)),1,'acceptance consumes one use');
create temp table expired as select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','family-test-expired@example.invalid') as payload;
update public.family_link_invites set expires_at = now() - interval '1 day' where id = (select (payload->'invite'->>'id')::uuid from expired);
insert into auth.users(id,email,email_confirmed_at) values ('e2000000-0000-4000-8000-000000000008','family-test-expired@example.invalid',now());
update public.accounts set auth_user_id = 'e2000000-0000-4000-8000-000000000008' where email = 'family-test-expired@example.invalid';
select throws_ok($$update public.family_link_invites set status = 'accepted', accepted_by_account_id = (select id from public.accounts where email = 'family-test-expired@example.invalid') where id = (select (payload->'invite'->>'id')::uuid from expired)$$,'22023',null,'expired invitations cannot be accepted through web callback');
create temp table unverified as select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000001','family-test-unverified@example.invalid') as payload;
insert into auth.users(id,email) values ('e2000000-0000-4000-8000-000000000009','family-test-unverified@example.invalid');
update public.accounts set auth_user_id = 'e2000000-0000-4000-8000-000000000009' where email = 'family-test-unverified@example.invalid';
select throws_ok($$update public.family_link_invites set status = 'accepted', accepted_by_account_id = (select id from public.accounts where email = 'family-test-unverified@example.invalid') where id = (select (payload->'invite'->>'id')::uuid from unverified)$$,'42501',null,'unverified recipients cannot join a family');
select throws_ok($$select public.revoke_family_child_invite('e3000000-0000-4000-8000-000000000002',(select (payload->'invite'->>'id')::uuid from unverified))$$,'42501',null,'another guardian cannot revoke this invitation');
select lives_ok($$select public.revoke_family_child_invite('e3000000-0000-4000-8000-000000000001',(select (payload->'invite'->>'id')::uuid from unverified))$$,'creator can revoke a pending invitation');
select ok(exists(select 1 from auth.users where id = 'e2000000-0000-4000-8000-000000000009'),'revoking an invitation preserves authentication identity');
select is((select status::text from public.family_link_invites where id = (select (payload->'invite'->>'id')::uuid from unverified)),'revoked','revocation keeps the invitation record for audit');
insert into public.family_link_invites(org_id,family_id,invited_role,invited_email,created_by_account_id,status)
select 'e1000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','child','rate-' || n || '@example.invalid','e3000000-0000-4000-8000-000000000002','revoked' from generate_series(1,10) n;
select throws_ok($$select public.prepare_family_child_invite('e3000000-0000-4000-8000-000000000002','rate-new@example.invalid')$$,'P0429',null,'email invitations are rate limited per guardian');
select * from finish();
rollback;
