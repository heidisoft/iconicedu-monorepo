DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'channels'
      AND column_name = 'call_config'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'channels'
      AND column_name = 'live_session_config'
  ) THEN
    ALTER TABLE public.channels
      RENAME COLUMN call_config TO live_session_config;
  END IF;
END $$;

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS live_session_config jsonb;
