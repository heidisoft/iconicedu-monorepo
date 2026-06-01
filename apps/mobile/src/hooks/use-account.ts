import { useFamilyView } from '@/providers/family-view-provider';

export type MobileAccountRecord = {
  id?: string | null;
  org_id?: string | null;
  active_profile_id?: string | null;
  profile?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

type MobileAccountQueryResult = {
  data: MobileAccountRecord | null;
  isPending: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
};

export function useAccount(): MobileAccountQueryResult {
  const familyView = useFamilyView();

  return {
    data: familyView.account,
    isPending: familyView.isPending,
    isError: familyView.isError,
    refetch: familyView.refresh,
  };
}
