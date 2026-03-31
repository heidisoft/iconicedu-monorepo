select pg_get_functiondef('public.can_post_to_channel_as_profile(uuid, uuid, uuid)'::regprocedure);
select pg_get_functiondef('public.can_insert_message(uuid, uuid, uuid, public.message_type)'::regprocedure);
