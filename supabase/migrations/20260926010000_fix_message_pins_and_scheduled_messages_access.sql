-- Issue #264 (messaging P2): message_pins and scheduled_messages were
-- created after 20260820010000_harden_public_api_role_grants.sql made all
-- future public-schema tables fail closed by default (RLS policies alone no
-- longer grant access — every new table needs an explicit GRANT). Neither
-- table's migration added one, so every authenticated-role read/write against
-- them fails with "permission denied for table ..." regardless of the RLS
-- policies already in place.
grant select, insert, update, delete on public.message_pins to authenticated;
grant select, insert, update, delete on public.scheduled_messages to authenticated;

-- message_pins.togglePin (apps/api) upserts on conflict of
-- (org_id, channel_id, message_id), reactivating the same row (clearing
-- deleted_at) rather than inserting a second one when a message is unpinned
-- and re-pinned. But the only index on those columns is the partial unique
-- index below (`where deleted_at is null`), and Postgres's plain
-- `ON CONFLICT (org_id, channel_id, message_id)` — which is what PostgREST's
-- on_conflict query param generates — cannot target a partial index without
-- also repeating its WHERE predicate. Replace it with a full unique
-- constraint so the upsert's conflict target actually resolves; this is safe
-- because the app never needs more than one history row per
-- (org, channel, message) — toggling reuses the same row either way.
drop index if exists public.message_pins_org_channel_message_active_idx;
alter table public.message_pins
  add constraint message_pins_org_channel_message_key
  unique (org_id, channel_id, message_id);
