import { useFamilyView } from '@/providers/family-view-provider';

export type MobileProfileRecord = {
  id?: string | null;
  kind?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  avatar_seed?: string | null;
  timezone?: string | null;
  [key: string]: unknown;
};

type MobileProfileQueryResult = {
  data: MobileProfileRecord | null;
  isPending: boolean;
  refetch: () => Promise<void>;
};

export function useProfile(): MobileProfileQueryResult {
  const familyView = useFamilyView();

  return {
    data: familyView.profile,
    isPending: familyView.isPending,
    refetch: familyView.refresh,
  };
}
