-- Public locators, never credentials. Database uniqueness prevents ambiguous routing.
ALTER TABLE public.channel_live_sessions
  ADD COLUMN share_code text NOT NULL
    DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  ADD CONSTRAINT channel_live_sessions_share_code_format
    CHECK (share_code ~ '^[a-f0-9]{12}$'),
  ADD CONSTRAINT channel_live_sessions_share_code_key UNIQUE (share_code);

COMMENT ON COLUMN public.channel_live_sessions.share_code IS
  'Random public meeting locator. Does not grant access or replace passcode verification.';

-- Stop returning credentials from stored join URLs for already-running meetings.
UPDATE public.channel_live_sessions
SET join_path = split_part(join_path, '?', 1)
WHERE provider = 'zoom' AND join_path LIKE '%?%';
