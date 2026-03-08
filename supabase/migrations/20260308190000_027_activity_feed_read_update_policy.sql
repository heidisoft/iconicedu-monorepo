-- Allow authenticated org members to update read state for their own inbox rows.
drop policy if exists "activity feed update own recipient rows" on public.activity_feed_items;

create policy "activity feed update own recipient rows"
  on public.activity_feed_items
  for update
  using (
    deleted_at is null
    and public.is_org_member(org_id)
    and public.is_profile_owner(recipient_profile_id)
  )
  with check (
    deleted_at is null
    and public.is_org_member(org_id)
    and public.is_profile_owner(recipient_profile_id)
  );
