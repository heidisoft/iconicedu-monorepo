-- Legacy Classroom/channel saves do not own the modular meeting policy. Preserve
-- it when those writers update only the existing provider/mode fields.
CREATE OR REPLACE FUNCTION public.preserve_classroom_meeting_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.live_session_config ? 'settings'
     AND jsonb_typeof(NEW.live_session_config) = 'object'
     AND NOT (NEW.live_session_config ? 'settings') THEN
    NEW.live_session_config := NEW.live_session_config || jsonb_build_object(
      'settings', OLD.live_session_config -> 'settings',
      'settingsProfileId', OLD.live_session_config -> 'settingsProfileId'
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_classroom_meeting_settings() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER preserve_classroom_meeting_settings
BEFORE UPDATE OF live_session_config ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.preserve_classroom_meeting_settings();
