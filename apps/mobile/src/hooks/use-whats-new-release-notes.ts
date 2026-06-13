import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { currentReleaseNotes, type ReleaseNotes } from '@/lib/release-notes';

export const WHATS_NEW_LAST_SEEN_KEY = 'whats_new_last_seen_release_id';

type UseWhatsNewReleaseNotesResult = {
  shouldShow: boolean;
  releaseNotes: ReleaseNotes;
  dismiss: () => void;
};

export function useWhatsNewReleaseNotes(
  releaseNotes: ReleaseNotes = currentReleaseNotes,
): UseWhatsNewReleaseNotesResult {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadLastSeenRelease() {
      try {
        const lastSeenReleaseId = await SecureStore.getItemAsync(WHATS_NEW_LAST_SEEN_KEY);
        if (isMounted) {
          setShouldShow(lastSeenReleaseId !== releaseNotes.id);
        }
      } catch {
        if (isMounted) {
          setShouldShow(true);
        }
      }
    }

    loadLastSeenRelease();

    return () => {
      isMounted = false;
    };
  }, [releaseNotes.id]);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    SecureStore.setItemAsync(WHATS_NEW_LAST_SEEN_KEY, releaseNotes.id).catch(() => {});
  }, [releaseNotes.id]);

  return {
    shouldShow,
    releaseNotes,
    dismiss,
  };
}
