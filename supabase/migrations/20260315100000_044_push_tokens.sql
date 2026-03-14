-- Migration 044: push_tokens table for Expo push notification token storage
-- Stores per-device Expo push tokens, linked to a profile.
-- The web push-provider reads these when dispatching push notifications.

CREATE TABLE push_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  profile_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE,
  platform    text        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id   text,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Partial index: only active (non-revoked) tokens, used by push-provider lookup
CREATE INDEX push_tokens_profile_id_idx ON push_tokens (profile_id) WHERE revoked_at IS NULL;

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Owners can insert tokens for their own profiles
CREATE POLICY "push_tokens_owner_insert" ON push_tokens
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  );

-- Owners can update (e.g. revoke) their own tokens
CREATE POLICY "push_tokens_owner_update" ON push_tokens
  FOR UPDATE USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  );

-- Owners can delete their own tokens (e.g. on logout)
CREATE POLICY "push_tokens_owner_delete" ON push_tokens
  FOR DELETE USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  );
