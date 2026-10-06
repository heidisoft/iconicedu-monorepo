import type {
  ClassroomMeetingSettingsVM,
  LiveSessionSettingsVM,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export function classroomMeetingSettingsApi(supabase: SupabaseClient) {
  const api = createApiClient(supabase);
  return {
    get: (orgSlug: string, classroomId?: string) =>
      api.get<ClassroomMeetingSettingsVM>('/classroom-meeting-settings', {
        orgSlug,
        classroomId,
      }),
    save: (input: {
      orgId: string;
      profileId: string;
      classroomId: string;
      settings: LiveSessionSettingsVM;
    }) => api.put<ClassroomMeetingSettingsVM>('/classroom-meeting-settings', input),
  };
}
