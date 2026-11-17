import type { ClassroomCallVM, ClassroomRosterVM } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiClient } from './http-client';
export function createClassroomCallsApi(supabase: SupabaseClient) {
  const api = createApiClient(supabase);
  const root = '/classroom-calls';
  return {
    detail: (id: string) =>
      api.get<ClassroomCallVM>(`${root}/${encodeURIComponent(id)}/detail`),
    joinMissed: (id: string) =>
      api.post<{ sessionId: string }>(`${root}/${encodeURIComponent(id)}/join`, {}),
    messageTutor: (id: string) =>
      api.post<{ nativePath: string; webPath: string }>(
        `${root}/${encodeURIComponent(id)}/message-tutor`,
        {},
      ),
    incoming: () => api.get<ClassroomCallVM[]>(`${root}/incoming`),
    roster: (id: string) =>
      api.get<ClassroomRosterVM>(`${root}/${encodeURIComponent(id)}/roster`),
    presence: (id: string, connectionId: string, profileIds: string[], active: boolean) =>
      api.post(`${root}/${encodeURIComponent(id)}/presence`, {
        connectionId,
        profileIds,
        active,
      }),
    ring: (id: string, profileId: string) =>
      api.post<ClassroomCallVM>(
        `${root}/${encodeURIComponent(id)}/ring/${encodeURIComponent(profileId)}`,
        {},
      ),
    respond: (id: string, action: 'accepted' | 'declined' | 'cancelled') =>
      api.post<{ sessionId: string }>(`${root}/${encodeURIComponent(id)}/respond`, {
        action,
      }),
  };
}
