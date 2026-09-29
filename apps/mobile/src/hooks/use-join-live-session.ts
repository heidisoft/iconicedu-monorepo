import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/http-client';
import { useAccount } from './use-account';
import { useProfile } from './use-profile';

export type JoinLiveSessionResult = {
  sessionId: string;
  joinPath: string;
  status: 'starting' | 'live' | 'ended' | 'failed';
  created: boolean;
  provider: string;
};

export function useJoinLiveSession() {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: (channelId: string) => {
      const orgId = account?.org_id;
      const profileId = profile?.id;
      if (!orgId || !profileId) {
        throw new Error('Not authenticated');
      }

      return apiPost<JoinLiveSessionResult>(`/channels/${channelId}/live-sessions/join`, {
        orgId,
        profileId,
      });
    },
  });
}
