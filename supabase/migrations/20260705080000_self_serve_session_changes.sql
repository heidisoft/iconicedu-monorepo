CREATE TABLE IF NOT EXISTS public.class_schedule_self_serve_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  learning_space_id UUID NOT NULL REFERENCES public.learning_spaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cutoff_hours INTEGER NOT NULL DEFAULT 48 CHECK (cutoff_hours >= 0 AND cutoff_hours <= 720),
  allow_guardian BOOLEAN NOT NULL DEFAULT TRUE,
  allow_educator BOOLEAN NOT NULL DEFAULT TRUE,
  allow_child BOOLEAN NOT NULL DEFAULT TRUE,
  within_cutoff_requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE (org_id, learning_space_id)
);

CREATE TABLE IF NOT EXISTS public.class_session_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  occurrence_key TIMESTAMPTZ,
  learning_space_id UUID REFERENCES public.learning_spaces(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('reschedule', 'cancel')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired', 'withdrawn')),
  requested_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by_role TEXT NOT NULL,
  requested_note TEXT,
  current_start_at TIMESTAMPTZ NOT NULL,
  current_end_at TIMESTAMPTZ NOT NULL,
  requested_start_at TIMESTAMPTZ,
  requested_end_at TIMESTAMPTZ,
  approval_required_from TEXT NOT NULL
    CHECK (approval_required_from IN ('educator', 'guardian', 'either_adult', 'staff')),
  decided_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS class_session_change_requests_one_pending_idx
  ON public.class_session_change_requests (
    org_id,
    schedule_id,
    COALESCE(occurrence_key, 'epoch'::timestamptz),
    request_type
  )
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS class_session_change_requests_schedule_idx
  ON public.class_session_change_requests (org_id, schedule_id, occurrence_key);

CREATE INDEX IF NOT EXISTS class_session_change_requests_requester_idx
  ON public.class_session_change_requests (org_id, requested_by_profile_id, created_at DESC);

ALTER TABLE public.class_schedule_self_serve_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_session_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self serve policies readable by org members"
  ON public.class_schedule_self_serve_policies;
CREATE POLICY "self serve policies readable by org members"
  ON public.class_schedule_self_serve_policies FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "change requests readable by org members"
  ON public.class_session_change_requests;
CREATE POLICY "change requests readable by org members"
  ON public.class_session_change_requests FOR SELECT
  USING (public.is_org_member(org_id));
