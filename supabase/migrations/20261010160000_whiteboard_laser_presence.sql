-- Ephemeral laser state inherits the service-only capability table policies.
ALTER TABLE public.classroom_whiteboard_access
  ADD COLUMN laser_samples jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN laser_updated_at timestamptz;
ALTER TABLE public.classroom_whiteboard_access
  ADD CONSTRAINT whiteboard_laser_samples_bounded CHECK (
    jsonb_typeof(laser_samples) = 'array' AND jsonb_array_length(laser_samples) <= 64
  );
