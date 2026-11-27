import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** A device-local presentation preference, scoped to one organization and parent. */
export function useHomeTileDismissal(scope: string, tileId: string) {
  const key = `home-tile-v1:${scope}:${tileId}`;
  const currentKey = useRef(key);
  currentKey.current = key;
  const [state, setState] = useState({ key: '', dismissed: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setSaving(false);
    AsyncStorage.getItem(key).then(
      (value) => {
        if (active) setState({ key, dismissed: value === '1' });
      },
      () => {
        if (active) setState({ key, dismissed: false });
      },
    );
    return () => {
      active = false;
    };
  }, [key]);
  const dismiss = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(key, '1');
      if (currentKey.current === key) setState({ key, dismissed: true });
    } finally {
      if (currentKey.current === key) setSaving(false);
    }
  }, [key, saving]);
  return {
    loaded: state.key === key,
    visible: state.key === key && !state.dismissed,
    dismiss,
    saving,
  };
}
