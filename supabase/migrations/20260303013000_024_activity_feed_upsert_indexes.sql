drop index if exists public.activity_feed_items_recipient_source_event_idx;
drop index if exists public.activity_feed_items_recipient_dedupe_idx;

create unique index if not exists activity_feed_items_recipient_source_event_idx
  on public.activity_feed_items (recipient_profile_id, source_event_id);

create unique index if not exists activity_feed_items_recipient_dedupe_idx
  on public.activity_feed_items (recipient_profile_id, dedupe_key);
