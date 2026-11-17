-- Viewports are ephemeral collaboration state under existing service-only policies.
ALTER TABLE public.classroom_whiteboard_access
  ADD COLUMN viewport jsonb,
  ADD COLUMN viewport_updated_at timestamptz;
ALTER TABLE public.classroom_whiteboard_access
  ADD CONSTRAINT whiteboard_viewport_object CHECK (
    viewport IS NULL OR jsonb_typeof(viewport) = 'object'
  );
