import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchProfileSettings } from '@/lib/api/profile-settings';
import { useProfile, type MobileProfileRecord } from './use-profile';

/** Existing settings screens can also edit an explicitly selected, authorized child. */
export function useSettingsProfile() {
  const current = useProfile();
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const selectedId = typeof profileId === 'string' ? profileId : '';
  const selected = useQuery({
    queryKey: ['profile-settings', selectedId],
    queryFn: () => fetchProfileSettings(selectedId),
    enabled: !!selectedId,
  });
  return selectedId
    ? {
        data: (selected.data?.profile as MobileProfileRecord | undefined) ?? null,
        isPending: selected.isPending,
        isError: selected.isError,
        refetch: selected.refetch,
      }
    : current;
}
