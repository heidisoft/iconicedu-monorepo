begin;
select plan(8);
select has_table('public', 'classroom_whiteboards', 'Independent classroom boards exist');
select has_table('public', 'classroom_whiteboard_access', 'Scoped capabilities exist');
select ok(not has_table_privilege('anon', 'public.classroom_whiteboards', 'SELECT'), 'Anonymous clients cannot read board tables');
select ok(not has_table_privilege('authenticated', 'public.classroom_whiteboard_access', 'INSERT'), 'Authenticated clients cannot forge capabilities');
select ok(not has_function_privilege('authenticated', 'public.commit_classroom_whiteboard(uuid,integer,jsonb,text)', 'EXECUTE'), 'Frontend roles cannot bypass API policy');

create temporary table whiteboard_test_ids (org_id uuid, channel_id uuid, board_id uuid);
insert into whiteboard_test_ids values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
insert into public.orgs (id, name, slug) select org_id, 'Whiteboard database test', 'whiteboard-db-test-' || org_id from whiteboard_test_ids;
insert into public.channels (id, org_id, kind, topic, visibility, purpose) select channel_id, org_id, 'channel', 'Whiteboard test', 'private', 'learning-space' from whiteboard_test_ids;
insert into public.classroom_whiteboards (id, org_id, channel_id, scope_key, document) select board_id, org_id, channel_id, 'test-occurrence', '{"schemaVersion":1,"studentEditing":true,"pages":[{"id":"one","title":"Page 1","elements":[]}]}' from whiteboard_test_ids;

select ok(public.commit_classroom_whiteboard(board_id, 0, '{"schemaVersion":1,"studentEditing":false,"pages":[{"id":"one","title":"Page 1","elements":[]}]}', 'first'), 'Current revision commits atomically') from whiteboard_test_ids;
select ok(not public.commit_classroom_whiteboard(board_id, 0, '{}', 'stale'), 'Stale revision cannot overwrite another write') from whiteboard_test_ids;
select is(b.revision, 1, 'Exactly one revision was committed') from public.classroom_whiteboards b join whiteboard_test_ids t on t.board_id = b.id;
select * from finish();
rollback;
