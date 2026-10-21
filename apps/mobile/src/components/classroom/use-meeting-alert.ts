import { useCallback, useRef } from 'react';
import { Alert, type AlertButton, type AlertOptions } from 'react-native';

/** Rapid taps must not queue several native dialogs behind the visible one. */
export function useMeetingAlert() {
  const visible = useRef(false);
  return useCallback(
    (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      options?: AlertOptions,
    ) => {
      if (visible.current) return false;
      visible.current = true;
      const release = () => {
        visible.current = false;
      };
      Alert.alert(
        title,
        message,
        (buttons ?? [{ text: 'OK' }]).map((button) => ({
          ...button,
          onPress: () => {
            release();
            button.onPress?.();
          },
        })),
        {
          ...options,
          onDismiss: () => {
            release();
            options?.onDismiss?.();
          },
        },
      );
      return true;
    },
    [],
  );
}
