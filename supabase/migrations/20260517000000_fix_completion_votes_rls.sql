-- Fix RLS policies on class_session_completion_votes.
-- The original policies used `profile_id = auth.uid()` which is always false
-- because profile_id stores a profiles UUID, not an auth.users UUID.
-- Correct pattern (used by push_tokens and others): join through accounts.

DROP POLICY IF EXISTS "profile_read_own_votes"   ON class_session_completion_votes;
DROP POLICY IF EXISTS "profile_insert_own_votes" ON class_session_completion_votes;
DROP POLICY IF EXISTS "profile_update_own_votes" ON class_session_completion_votes;

CREATE POLICY "profile_read_own_votes"
  ON class_session_completion_votes
  FOR SELECT
  USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "profile_insert_own_votes"
  ON class_session_completion_votes
  FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "profile_update_own_votes"
  ON class_session_completion_votes
  FOR UPDATE
  USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  );
