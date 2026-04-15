-- Replace the fragile table-level RLS upsert path with a SECURITY DEFINER RPC.
--
-- Problem: the push_tokens RLS chain (INSERT WITH CHECK + UPDATE USING/WITH CHECK)
-- keeps failing in practice because the CTE-wrapped upsert that PostgREST generates
-- evaluates policies differently from a plain INSERT, and the guardian check
-- (is_guardian_of_profile) is not reliably returning true in all cases.
--
-- Fix: expose a single `upsert_push_token` SECURITY DEFINER function that:
--   1. Validates the caller can write the token (owns the profile OR is a guardian)
--   2. Executes the upsert itself, bypassing per-row RLS
-- This is the standard Supabase pattern for operations that require cross-account
-- writes that RLS alone cannot cleanly express.
--
-- The table-level policies are kept so direct table access (e.g. revokePushToken
-- which already works) continues to behave correctly.

CREATE OR REPLACE FUNCTION public.upsert_push_token(
  _org_id     uuid,
  _profile_id uuid,
  _token      text,
  _platform   text,
  _now        timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate: caller must own the profile or supervise it as a guardian.
  IF NOT (
    public.is_profile_owner(_profile_id)
    OR public.is_guardian_of_profile(_profile_id)
  ) THEN
    RAISE EXCEPTION 'permission denied for push token registration'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.push_tokens (
    org_id, profile_id, token, platform, revoked_at, created_at, updated_at
  )
  VALUES (
    _org_id, _profile_id, _token, _platform, NULL, _now, _now
  )
  ON CONFLICT (token) DO UPDATE SET
    org_id     = EXCLUDED.org_id,
    profile_id = EXCLUDED.profile_id,
    platform   = EXCLUDED.platform,
    revoked_at = NULL,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Allow authenticated users to call the function.
GRANT EXECUTE ON FUNCTION public.upsert_push_token(uuid, uuid, text, text, timestamptz)
  TO authenticated;
