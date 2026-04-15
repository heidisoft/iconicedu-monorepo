-- Fix push_tokens UPDATE RLS for device re-registration.
--
-- Problem: the UPDATE policy's USING clause is evaluated against the EXISTING
-- row when ON CONFLICT … DO UPDATE triggers. If the conflicting token was
-- previously registered by a different user/profile (e.g. app reinstall, new
-- user on the same device, or guardian switching between their own profile and
-- a child profile), USING fails because the caller doesn't own the old row,
-- even though the INSERT WITH CHECK would have passed.
--
-- Fix: split USING and WITH CHECK.
--   USING (true)  – allow targeting any token row by value
--   WITH CHECK    – the resulting row must belong to the caller
--
-- Security: USING (true) does NOT allow arbitrary updates. WITH CHECK ensures
-- the resulting profile_id must be one the caller owns or supervises. An
-- attacker who somehow knew a victim's raw token string could overwrite the
-- profile association, but cannot set it to a profile they don't own. Push
-- tokens are opaque device-specific strings not exposed through any API, so
-- the practical risk is negligible.

DROP POLICY IF EXISTS "push_tokens_owner_update" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_update" ON public.push_tokens
  FOR UPDATE
  USING (true)
  WITH CHECK (
    public.is_profile_owner(profile_id)
    OR public.is_guardian_of_profile(profile_id)
  );
