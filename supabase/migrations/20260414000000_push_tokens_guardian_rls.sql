-- Migration: extend push_tokens RLS so a guardian can register/revoke tokens
-- for child profiles they supervise.
--
-- Problem: when a guardian's device is in "view as child" mode, the mobile
-- client calls storePushToken with the child's profile_id. The original
-- INSERT/UPDATE/DELETE policies only allow access to profiles the caller
-- directly owns (via their own account), so the upsert fails with
-- "new row violates row-level security policy".
--
-- Fix: add a secondary check that passes when the caller is a guardian whose
-- account is linked to the child's account via family_links. This lets the
-- guardian's device register its Expo push token under the child's profile so
-- that child-directed notifications (dispatched by profile_id) reach the
-- guardian's physical device.

-- Helper: returns true when the calling user is a guardian of the given profile
-- (i.e. a family_links row exists linking guardian_account → child_account, where
-- child_account owns the profile). SECURITY DEFINER so it bypasses RLS on the
-- referenced tables.
CREATE OR REPLACE FUNCTION public.is_guardian_of_profile(_profile_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_links fl
    JOIN public.profiles   cp  ON cp.id = _profile_id
    JOIN public.accounts   ga  ON ga.id = fl.guardian_account_id
    WHERE fl.child_account_id = cp.account_id
      AND ga.auth_user_id     = auth.uid()
      AND fl.deleted_at       IS NULL
      AND cp.deleted_at       IS NULL
      AND ga.deleted_at       IS NULL
  );
$$;

-- INSERT: own profile or supervised child profile
DROP POLICY IF EXISTS "push_tokens_owner_insert" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_insert" ON public.push_tokens
  FOR INSERT WITH CHECK (
    public.is_profile_owner(profile_id)
    OR public.is_guardian_of_profile(profile_id)
  );

-- UPDATE (upsert conflict path + explicit revoke): same check
DROP POLICY IF EXISTS "push_tokens_owner_update" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_update" ON public.push_tokens
  FOR UPDATE USING (
    public.is_profile_owner(profile_id)
    OR public.is_guardian_of_profile(profile_id)
  );

-- DELETE (logout revoke): same check
DROP POLICY IF EXISTS "push_tokens_owner_delete" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_delete" ON public.push_tokens
  FOR DELETE USING (
    public.is_profile_owner(profile_id)
    OR public.is_guardian_of_profile(profile_id)
  );
