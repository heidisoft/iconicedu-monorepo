import { useQuery } from '@tanstack/react-query';
import { fetchProfile, queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';

export function useProfile() {
  const { data: account } = useAccount();
  const profileId = (account as Record<string, unknown> | undefined)
    ?.default_profile_id as string | undefined;

  return useQuery({
    queryKey: queryKeys.profile(profileId ?? ''),
    queryFn: () => fetchProfile(profileId!),
    enabled: !!profileId,
  });
}
