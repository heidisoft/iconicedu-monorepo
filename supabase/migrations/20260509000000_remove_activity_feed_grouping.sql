drop table if exists public.activity_feed_group_members;

delete from public.activity_feed_items
where kind = 'group';

alter table public.activity_feed_items
  drop column if exists group_key,
  drop column if exists group_type,
  drop column if exists is_collapsed,
  drop column if exists sub_activity_count;

drop type if exists public.activity_group_key;
