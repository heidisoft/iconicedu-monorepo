ALTER TABLE public.class_session_change_requests
  ADD COLUMN IF NOT EXISTS requested_timezone TEXT;

DROP POLICY IF EXISTS "change requests readable by org members"
  ON public.class_session_change_requests;

CREATE POLICY "change requests readable by org members"
  ON public.class_session_change_requests FOR SELECT
  USING (
    public.is_org_member(org_id)
    AND (
      EXISTS (
        SELECT 1
        FROM public.accounts account
        JOIN public.class_schedule_participants participant
          ON participant.org_id = account.org_id
         AND participant.profile_id = account.active_profile_id
         AND participant.deleted_at IS NULL
        WHERE participant.org_id = class_session_change_requests.org_id
          AND participant.schedule_id = class_session_change_requests.schedule_id
          AND account.auth_user_id = auth.uid()
          AND account.org_id = class_session_change_requests.org_id
          AND account.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.accounts account
        JOIN public.user_roles role
          ON role.account_id = account.id
         AND role.org_id = account.org_id
         AND role.deleted_at IS NULL
        WHERE account.auth_user_id = auth.uid()
          AND account.org_id = class_session_change_requests.org_id
          AND account.deleted_at IS NULL
          AND role.role_key IN ('owner', 'admin', 'staff')
      )
    )
  );
