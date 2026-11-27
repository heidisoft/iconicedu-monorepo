begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into public.orgs(id,name,slug) values ('f1000000-0000-4000-8000-000000000001','Referral test','referral-test'),('f1000000-0000-4000-8000-000000000002','Other referral test','referral-other');
insert into auth.users(id,email,email_confirmed_at) values
('f2000000-0000-4000-8000-000000000001','referrer@example.invalid',now()),
('f2000000-0000-4000-8000-000000000002','new-parent@example.invalid',now()),
('f2000000-0000-4000-8000-000000000003','existing@example.invalid',now()),
('f2000000-0000-4000-8000-000000000004','unverified@example.invalid',null),
('f2000000-0000-4000-8000-000000000005','named-parent@example.invalid',now()),
('f2000000-0000-4000-8000-000000000006','staff-referral@example.invalid',now());
insert into public.accounts(id,org_id,auth_user_id,email,primary_role,status,onboarding_completed_at) values
('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','referrer@example.invalid','guardian','active',now()),
('f3000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','new-parent@example.invalid',null,'active',null),
('f3000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000003','existing@example.invalid','guardian','active',now()),
('f3000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000004','unverified@example.invalid',null,'active',null),
('f3000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000005','named-parent@example.invalid',null,'active',null),
('f3000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000006','staff-referral@example.invalid','staff','active',now());
insert into public.profiles(org_id,account_id,kind,display_name,avatar_source,avatar_seed) select org_id,id,'guardian',case when id='f3000000-0000-4000-8000-000000000001' then 'Test Referrer' else 'New Parent' end,'seed','test' from public.accounts where org_id='f1000000-0000-4000-8000-000000000001' and primary_role is distinct from 'staff';
select ok(not has_table_privilege('authenticated','public.parent_referrals','SELECT'),'referral details cannot be read directly by clients');
select ok(not has_function_privilege('anon','public.resolve_parent_referral(text)','EXECUTE'),'anonymous users cannot bypass the API');
select ok(not has_function_privilege('authenticated','public.record_parent_referral(uuid,uuid,text,text)','EXECUTE'),'clients cannot forge an attribution actor');
select ok(not has_table_privilege('service_role','public.parent_referral_events','UPDATE'),'audit history is append-only');
select throws_ok($$select public.get_parent_referral_link('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002')$$,'42501',null,'links cannot be generated across organizations');
select throws_ok($$select public.get_parent_referral_link('f2000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000001')$$,'42501',null,'staff cannot generate parent links');
create temp table invitation as select public.get_parent_referral_link('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001')->>'code' as code;
select matches((select code from invitation),'^[a-f0-9]{48}$','links use opaque, unguessable codes');
select is(public.get_parent_referral_link('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001')->>'code',(select code from invitation),'repeated sharing reuses one link');
select is(public.resolve_parent_referral((select code from invitation))->>'referrerName','Test Referrer','landing exposes only the public display name');
select is(public.resolve_parent_referral((select code from invitation))->>'orgSlug','referral-test','landing points to the referring parent organization');
select is(public.resolve_parent_referral(repeat('a',48)),null,'unknown links have no landing payload');
select throws_ok($$select public.record_parent_referral('f2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001',null,'Other Parent')$$,'42501',null,'existing onboarded accounts cannot claim referrals');
select throws_ok($$select public.record_parent_referral('f2000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000001',null,'Other Parent')$$,'42501',null,'unverified accounts cannot create referral claims');
select throws_ok($$select public.record_parent_referral('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002',null,'Other Parent')$$,'42501',null,'new parent attribution cannot cross organizations');
create temp table claim as select public.record_parent_referral('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001',(select code from invitation),'Ignored Name') as id;
select is((select status from public.parent_referrals where id=(select id from claim)),'pending_review','signup does not automatically award money');
select is((select claimed_referrer_name from public.parent_referrals where id=(select id from claim)),'Test Referrer','valid links override typed names');
select is((select reward_label from public.parent_referrals where id=(select id from claim)),'$20 off','referral benefit is captured');
select ok(exists(select 1 from public.parent_referral_events where referral_id=(select id from claim) and actor_auth_user_id='f2000000-0000-4000-8000-000000000002'),'attribution is audited to the authenticated new parent');
select public.record_parent_referral('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001',null,'Changed Name');
select is((select count(*) from public.parent_referrals where referred_account_id='f3000000-0000-4000-8000-000000000002'),1::bigint,'retry creates no duplicate reward claim');
select is((select attribution_source from public.parent_referrals where id=(select id from claim)),'link','retry cannot replace the original attribution');
create temp table named as select public.record_parent_referral('f2000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000001',null,'  Parent Without Link  ') as id;
select is((select claimed_referrer_name from public.parent_referrals where id=(select id from named)),'Parent Without Link','manual names are stored for review');
select is((select referrer_account_id from public.parent_referrals where id=(select id from named)),null,'names are not automatically matched to accounts');
select throws_ok($$select public.review_parent_referral('f2000000-0000-4000-8000-000000000001',(select id from claim),'approved','Checked')$$,'42501',null,'parents cannot approve their own rewards');
select throws_ok($$select public.review_parent_referral('f2000000-0000-4000-8000-000000000006',(select id from named),'approved','Checked')$$,'22023',null,'staff must resolve a name to a parent account before approval');
select throws_ok($$select public.review_parent_referral('f2000000-0000-4000-8000-000000000006',(select id from claim),'fulfilled','Stripe completed')$$,'22023',null,'discounts cannot be marked fulfilled without approval');
select lives_ok($$select public.review_parent_referral('f2000000-0000-4000-8000-000000000006',(select id from claim),'approved','Confirmed new parent')$$,'staff can approve a verified referral');
select lives_ok($$select public.review_parent_referral('f2000000-0000-4000-8000-000000000006',(select id from claim),'fulfilled','Stripe discount recorded manually')$$,'staff can record manual Stripe fulfilment');
select ok(exists(select 1 from public.parent_referral_events where referral_id=(select id from claim) and actor_auth_user_id='f2000000-0000-4000-8000-000000000006' and after_data->>'status'='fulfilled'),'fulfilment is audited to the reviewer');
select is((select count(*) from public.parent_referral_events where referral_id=(select id from claim)),3::bigint,'creation, approval, and fulfilment each have one audit event');
select * from finish();
rollback;
