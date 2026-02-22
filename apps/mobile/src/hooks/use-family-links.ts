import { useQuery } from '@tanstack/react-query';
import {
  fetchFamilyLinks,
  fetchProfilesByAccountIds,
  queryKeys,
} from '@/lib/api/queries';
import { useAccount } from './use-account';

export function useFamilyLinks() {
  const { data: account } = useAccount();
  const acc = account as Record<string, unknown> | undefined;
  const orgId = acc?.org_id as string | undefined;
  const accountId = acc?.id as string | undefined;

  const { data: links = [], isLoading: linksLoading } = useQuery({
    queryKey: queryKeys.familyLinks(orgId ?? '', accountId ?? ''),
    queryFn: () => fetchFamilyLinks(orgId!, accountId!),
    enabled: !!orgId && !!accountId,
  });

  const childAccountIds = (links as Record<string, unknown>[]).map(
    (l) => l.child_account_id as string,
  );

  const { data: childProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: queryKeys.childProfiles(orgId ?? '', childAccountIds),
    queryFn: () => fetchProfilesByAccountIds(orgId!, childAccountIds),
    enabled: !!orgId && childAccountIds.length > 0,
  });

  return {
    links: links as Record<string, unknown>[],
    childProfiles: childProfiles as Record<string, unknown>[],
    isLoading: linksLoading || profilesLoading,
  };
}
