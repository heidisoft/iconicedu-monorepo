import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionJoinRequest,
  PublicLiveSessionInfoVM,
  MeetingAdmissionVM,
  MeetingWaitingParticipantVM,
} from '@iconicedu/shared-types';
import { apiPost, publicApiGet, publicApiPost } from '@/lib/api/http-client';

export type ClassroomJoinResult =
  | LiveSessionJoinCredentialsVM
  | { admission: MeetingAdmissionVM };
const route = (id: string, action: string) =>
  `/live-sessions/${encodeURIComponent(id)}/${action}`;
/** Native meetings share the web authorization/admission contract; secrets stay in apps/api. */
export const classroomApi = {
  info: (id: string) => publicApiGet<PublicLiveSessionInfoVM>(route(id, 'public-info')),
  join: (id: string, body: LiveSessionJoinRequest) =>
    publicApiPost<ClassroomJoinResult>(route(id, 'guest-join'), {
      ...body,
    }),
  linkInfo: (id: string, token: string) =>
    publicApiPost<{ info: PublicLiveSessionInfoVM; linkToken: string }>(
      route(id, 'link-info'),
      { token, handoff: false },
    ),
  admission: (id: string, token: string, cancel = false) =>
    publicApiPost<MeetingAdmissionVM>(route(id, 'admission-status'), { token, cancel }),
  waiting: (id: string) =>
    apiPost<MeetingWaitingParticipantVM[]>(route(id, 'waiting-room'), {}),
  admit: (id: string, decision: { id: string; approved: boolean }) =>
    apiPost<{ success: true }>(route(id, 'waiting-room'), decision),
  audit: (
    id: string,
    action: 'mute_participant' | 'end_session_for_all' | 'recording_started',
    targetDisplayName?: string,
  ) =>
    apiPost(route(id, 'audit-events'), {
      action,
      targetDisplayName,
      occurredAt: new Date().toISOString(),
    }),
  quality: (
    id: string,
    metric: 'network_quality' | 'connection_state',
    level: string,
    displayName: string,
  ) =>
    publicApiPost(route(id, 'quality-events'), {
      metric,
      level,
      displayName,
      occurredAt: new Date().toISOString(),
    }),
  feedback: (id: string, rating: number, displayName: string) =>
    publicApiPost(route(id, 'feedback'), {
      rating,
      displayName,
    }),
};
