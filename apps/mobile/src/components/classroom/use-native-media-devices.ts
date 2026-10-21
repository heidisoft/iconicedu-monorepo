import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  NativeMeetingAdapter,
  NativeMediaDevices,
} from '@/lib/classroom/meeting-controller';
export function useNativeMediaDevices(adapter: NativeMeetingAdapter, open: boolean) {
  const [devices, setDevices] = useState<NativeMediaDevices>({
    cameras: [],
    audio: [],
    mirrored: false,
  });
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  const refresh = useCallback(async () => {
    if (!adapter.devices) return;
    const request = ++epoch.current;
    try {
      const result = await adapter.devices();
      if (request === epoch.current) {
        setDevices(result);
        setError(null);
      }
    } catch {
      if (request === epoch.current)
        setError('Unable to refresh media devices. Reconnect your device and retry.');
    }
  }, [adapter]);
  const invalidate = useCallback(() => {
    ++epoch.current;
  }, []);
  useEffect(() => {
    if (!open) return;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 2000);
    return () => {
      invalidate();
      clearInterval(timer);
    };
  }, [open, refresh, invalidate]);
  const select = useCallback(
    async (kind: 'camera' | 'audio' | 'microphone', id: string) => {
      try {
        if (kind === 'camera') await adapter.selectCamera?.(id);
        else if (kind === 'microphone') {
          if (!adapter.selectMicrophone)
            throw new Error('Microphone selection is unavailable in this app version.');
          await adapter.selectMicrophone(id);
        } else await adapter.selectAudioRoute?.(id);
      } finally {
        await refresh();
      }
    },
    [adapter, refresh],
  );
  return { devices, error, refresh, select };
}
