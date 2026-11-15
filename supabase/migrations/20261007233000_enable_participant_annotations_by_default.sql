-- New screen shares allow authorized participants to annotate, like classroom whiteboards.
-- Preserve existing sessions and explicit presenter restrictions.
alter table public.screen_annotation_sessions
  alter column students_enabled set default true;
