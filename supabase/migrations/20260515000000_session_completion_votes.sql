-- Session completion votes: records each participant's YES/NO answer
-- after a class session ends, before feedback is collected.

CREATE TABLE class_session_completion_votes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES orgs(id),
  schedule_id          UUID NOT NULL REFERENCES class_schedules(id),
  occurrence_key       TIMESTAMPTZ NOT NULL,
  profile_id           UUID NOT NULL REFERENCES profiles(id),
  role                 TEXT NOT NULL
                         CHECK (role IN ('educator','child','guardian','staff','observer')),
  status               TEXT NOT NULL
                         CHECK (status IN ('confirmed','disputed')),
  dispute_category     TEXT
                         CHECK (dispute_category IN ('teacher_absent','student_absent','technical_issue','other')),
  dispute_reason       TEXT CHECK (char_length(dispute_reason) <= 500),
  reschedule_requested BOOLEAN NOT NULL DEFAULT FALSE,
  voted_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by           UUID,
  deleted_at           TIMESTAMPTZ,
  deleted_by           UUID,
  UNIQUE (org_id, schedule_id, occurrence_key, profile_id)
);

-- Indexes for common lookups
CREATE INDEX class_session_completion_votes_schedule_idx
  ON class_session_completion_votes (org_id, schedule_id, occurrence_key)
  WHERE deleted_at IS NULL;

CREATE INDEX class_session_completion_votes_profile_idx
  ON class_session_completion_votes (org_id, profile_id, voted_at DESC)
  WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE class_session_completion_votes ENABLE ROW LEVEL SECURITY;

-- Each profile can read, insert, and update only their own votes
CREATE POLICY "profile_read_own_votes"
  ON class_session_completion_votes
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "profile_insert_own_votes"
  ON class_session_completion_votes
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "profile_update_own_votes"
  ON class_session_completion_votes
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Service role bypass (API uses service role for reads/writes)
CREATE POLICY "service_role_all"
  ON class_session_completion_votes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
