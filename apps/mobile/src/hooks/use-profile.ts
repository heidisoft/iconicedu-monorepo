import { useQuery } from '@tanstack/react-query';
import { fetchProfileByAccountId } from '@/lib/api/queries';
import { useAccount } from './use-account';

export function useProfile() {
  const { data: account } = useAccount();
  const accountId = (account as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  return useQuery({
    queryKey: ['profile-by-account', accountId],
    queryFn: () => fetchProfileByAccountId(accountId!),
    enabled: !!accountId,
  });
}
