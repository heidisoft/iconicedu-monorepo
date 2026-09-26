-- Issue #264 (messaging P1): per-conversation notification controls need
-- more than an on/off mute. Add a richer mode alongside the existing
-- `muted` boolean (kept in sync for any reader that only understands the
-- boolean) so `resolveEffectivePreference`/the notification decision engine
-- can distinguish normal / mentions-only / temporary mute / muted-until-
-- re-enabled.

alter table public.notification_preference_scopes
  add column if not exists mode text not null default 'normal'
    check (mode in ('normal', 'mentions_only', 'muted_until', 'muted_until_enabled')),
  add column if not exists muted_until timestamptz;

-- Backfill: any existing row with muted = true becomes muted_until_enabled
-- (the closest prior meaning of a plain boolean mute with no expiry).
update public.notification_preference_scopes
   set mode = 'muted_until_enabled'
 where muted is true
   and mode = 'normal';
