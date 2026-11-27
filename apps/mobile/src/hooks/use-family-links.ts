import { useQuery } from '@tanstack/react-query';
import {
  fetchFamilyLinks,
  fetchProfilesByAccountIds,
  queryKeys,
} from '@/lib/api/queries';
import { useFamilyView } from '@/providers/family-view-provider';

export function useFamilyLinks() {
  const { account, guardianAccountId } = useFamilyView();
  const acc = account;
  const orgId = acc?.org_id as string | undefined;
  const accountId = guardianAccountId;

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
