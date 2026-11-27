import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

function storageKey(profileId: string): string {
  return `hidden-channels:${profileId}`;
}

async function loadHiddenIds(profileId: string): Promise<Set<string>> {
  if (!profileId) return new Set();
  try {
    const raw = await AsyncStorage.getItem(storageKey(profileId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

async function saveHiddenIds(profileId: string, ids: Set<string>): Promise<void> {
  if (!profileId) return;
  try {
    await AsyncStorage.setItem(storageKey(profileId), JSON.stringify([...ids]));
  } catch {
    // Swallow — hidden state is best-effort local storage.
  }
}

export type UseHiddenChannelsResult = {
  hiddenChannelIds: Set<string>;
  isReady: boolean;
  hideChannel: (channelId: string) => void;
  unhideChannel: (channelId: string) => void;
};

export function useHiddenChannels(profileId: string): UseHiddenChannelsResult {
  const [hiddenChannelIds, setHiddenChannelIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!profileId) {
      setHiddenChannelIds(new Set());
      setIsReady(true);
      return;
    }
    setIsReady(false);
    void loadHiddenIds(profileId).then((ids) => {
      setHiddenChannelIds(ids);
      setIsReady(true);
    });
  }, [profileId]);

  const hideChannel = useCallback(
    (channelId: string) => {
      setHiddenChannelIds((prev) => {
        const next = new Set(prev);
        next.add(channelId);
        void saveHiddenIds(profileId, next);
        return next;
      });
    },
    [profileId],
  );

  const unhideChannel = useCallback(
    (channelId: string) => {
      setHiddenChannelIds((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        void saveHiddenIds(profileId, next);
        return next;
      });
    },
    [profileId],
  );

  return { hiddenChannelIds, isReady, hideChannel, unhideChannel };
}
