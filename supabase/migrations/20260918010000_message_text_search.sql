-- Issue #264 (messaging P2): search within messages. Full-text search over
-- text message bodies, scoped to a single channel/thread first (per the
-- issue's own recommended scoping) and always re-filtered through the same
-- visibility rules as the regular message list — this column/index only
-- makes matching fast, it grants no new read access on its own (message_text
-- keeps its existing RLS policies).

alter table public.message_text
  add column search_vector tsvector
    generated always as (to_tsvector('english', coalesce(payload->>'text', ''))) stored;

create index message_text_search_vector_idx
  on public.message_text using gin (search_vector);
