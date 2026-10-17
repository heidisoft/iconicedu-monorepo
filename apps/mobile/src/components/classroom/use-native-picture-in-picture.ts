import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { NativeMeetingState } from '@/lib/classroom/meeting-controller';
import type { NativePictureInPictureAdapter } from '@/lib/classroom/native-picture-in-picture';
const preference = 'classroom:automatic-picture-in-picture';
export function pictureInPictureTarget(
  state: NativeMeetingState,
  focusedId?: string | null,
) {
  const sharing =
    state.sharingUserId && state.sharingUserId !== state.selfId
      ? state.participants.find((user) => user.id === state.sharingUserId)
      : undefined;
  if (sharing) return { user: sharing, sharing: true };
  const focused = state.participants.find((user) => user.id === focusedId);
  const speaker = state.participants.find(
    (user) => state.speaking.includes(user.id) && user.id !== state.selfId && user.video,
  );
  const user =
    focused ??
    speaker ??
    state.participants.find((user) => user.id !== state.selfId && user.video) ??
    state.participants.find((user) => user.id !== state.selfId) ??
    state.participants.find((user) => user.id === state.selfId);
  return user ? { user, sharing: false } : null;
}
/** Serialize native configuration so a delayed update cannot revive PiP after leaving. */
export function useNativePictureInPicture(
  adapter: NativePictureInPictureAdapter | undefined,
  state: NativeMeetingState,
  focusedId?: string | null,
  blocked = false,
) {
  const [supported, setSupported] = useState(false),
    [automatic, setAutomatic] = useState(false);
  const [active, setActive] = useState(false),
    [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const target = useMemo(
    () => pictureInPictureTarget(state, focusedId),
    [state, focusedId],
  );
  const enabled =
    !blocked && (state.phase === 'meeting' || state.phase === 'reconnecting');
  const configure = useCallback(
    (id: string, sharing: boolean, auto: boolean) => {
      const next = chain.current
        .catch(() => {})
        .then(() => adapter?.configure(id, sharing, auto));
      chain.current = next;
      return next;
    },
    [adapter],
  );
  useEffect(() => {
    let mounted = true;
    void adapter
      ?.supported()
      .then((value) => {
        if (mounted) setSupported(value);
      })
      .catch(() => {
        if (mounted) setSupported(false);
      });
    void AsyncStorage.getItem(preference)
      .then((value) => {
        if (mounted) setAutomatic(value === 'true');
      })
      .catch(() => {});
    const unsubscribe = adapter?.subscribe(setActive);
    return () => {
      mounted = false;
      unsubscribe?.();
      void configure('', false, false).catch(() => {});
    };
  }, [adapter, configure]);
  const userId = target?.user.id ?? '';
  const sharing = target?.sharing ?? false;
  useEffect(() => {
    let mounted = true;
    setReady(false);
    if (!adapter || !supported) return;
    void configure(enabled ? userId : '', sharing, enabled && automatic)
      .then(() => {
        if (mounted) {
          setReady(enabled && !!userId);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted)
          setError('Floating call is unavailable. Keep the classroom open or retry.');
      });
    return () => {
      mounted = false;
    };
  }, [adapter, supported, enabled, userId, sharing, automatic, configure]);
  const enter = useCallback(async () => {
    if (!adapter || !ready)
      throw new Error('Wait for the meeting before opening a floating call.');
    setError(null);
    if (Platform.OS === 'android') {
      setActive(true);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    }
    try {
      await adapter.enter();
    } catch (cause) {
      setActive(false);
      throw cause;
    }
  }, [adapter, ready]);
  const changeAutomatic = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(preference, String(value));
    setAutomatic(value);
  }, []);
  return { supported, automatic, active, ready, target, error, enter, changeAutomatic };
}
