import { enableClassroomMeetingSettings } from '@iconicedu/web/flags';
import type { LiveSessionSettingsVM } from '@iconicedu/shared-types';
import { requireAdminAuthContext } from './_auth-context';
import { classroomMeetingSettingsApi } from '@iconicedu/web/lib/live-sessions/classroom-meeting-settings-api';

export async function saveClassroomMeetingSettings(
  classroomId: string,
  settings: LiveSessionSettingsVM,
) {
  const auth = await requireAdminAuthContext();
  const enabled = await enableClassroomMeetingSettings.run({
    identify: () => ({ profileId: auth.profileId }),
  });
  if (!enabled) throw new Error('Classroom meeting settings are not enabled');
  return classroomMeetingSettingsApi(auth.supabase).save({
    classroomId,
    settings,
    orgId: auth.orgId,
    profileId: auth.profileId,
  });
}
