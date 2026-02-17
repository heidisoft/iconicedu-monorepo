import { useQuery } from '@tanstack/react-query';
import { fetchUserAccount } from '@/lib/api/queries';
import { useAuth } from '@/providers/auth-provider';

export function useAccount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['account', user?.id],
    queryFn: fetchUserAccount,
    enabled: !!user,
  });
}
