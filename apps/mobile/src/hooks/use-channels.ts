import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchChannels } from '@/lib/api/queries';
import { useAccount } from './use-account';

export function useChannels(orgId: string) {
  const { data: account } = useAccount();
  const accountId = (account as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;
  return useQuery({
    queryKey: queryKeys.channels(orgId),
    queryFn: () => fetchChannels(orgId, accountId ?? ''),
    enabled: !!orgId && !!accountId,
  });
}
