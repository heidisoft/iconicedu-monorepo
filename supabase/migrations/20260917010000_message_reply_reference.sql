-- Issue #264 (messaging P1): "reply to a specific message" is a lightweight
-- quote reference rendered inline above the composer / on the message
-- itself, distinct from the existing thread_id/thread_parent_id mechanism
-- (which creates a separate thread view). A message may have at most one
-- reply reference, and it is informational only — it does not affect
-- channel/thread membership, unread counts, or notification routing.

alter table public.messages
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;

create index if not exists messages_reply_to_message_id_idx
  on public.messages (reply_to_message_id)
  where deleted_at is null;
