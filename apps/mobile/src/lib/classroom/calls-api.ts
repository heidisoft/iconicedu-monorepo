import type { ClassroomCallVM, ClassroomRosterVM } from '@iconicedu/shared-types';
import { apiGet, apiPost } from '@/lib/api/http-client';
const root = '/classroom-calls';
export const classroomCallsApi = {
  detail: (id: string) =>
    apiGet<ClassroomCallVM>(`${root}/${encodeURIComponent(id)}/detail`),
  joinMissed: (id: string) =>
    apiPost<{ sessionId: string }>(`${root}/${encodeURIComponent(id)}/join`, {}),
  messageTutor: (id: string) =>
    apiPost<{ nativePath: string; webPath: string }>(
      `${root}/${encodeURIComponent(id)}/message-tutor`,
      {},
    ),
  incoming: () => apiGet<ClassroomCallVM[]>(`${root}/incoming`),
  roster: (id: string) =>
    apiGet<ClassroomRosterVM>(`${root}/${encodeURIComponent(id)}/roster`),
  presence: (id: string, connectionId: string, profileIds: string[], active: boolean) =>
    apiPost(`${root}/${encodeURIComponent(id)}/presence`, {
      connectionId,
      profileIds,
      active,
    }),
  ring: (id: string, profileId: string) =>
    apiPost<ClassroomCallVM>(
      `${root}/${encodeURIComponent(id)}/ring/${encodeURIComponent(profileId)}`,
      {},
    ),
  respond: (id: string, action: 'accepted' | 'declined' | 'cancelled') =>
    apiPost<{ sessionId: string }>(`${root}/${encodeURIComponent(id)}/respond`, {
      action,
    }),
};
