import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';

type ToastVariant = 'success' | 'error';

type ToastState = {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  stack: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  toast: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const nextIdRef = useRef(1);
  const timeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    const timeout = timeoutsRef.current[id];
    if (timeout) {
      clearTimeout(timeout);
      delete timeoutsRef.current[id];
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (title: string, message: string | undefined, variant: ToastVariant) => {
      const id = nextIdRef.current++;
      setToasts((current) => [...current, { id, title, message, variant }]);
      timeoutsRef.current[id] = setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      Object.values(timeoutsRef.current).forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current = {};
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title, message) => show(title, message, 'success'),
      error: (title, message) => show(title, message, 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        <View
          pointerEvents="box-none"
          style={[styles.overlay, { paddingTop: insets.top }]}
        >
          <View style={styles.stack}>
            {toasts.map((toast) => {
              const isError = toast.variant === 'error';
              return (
                <View
                  key={toast.id}
                  style={[
                    styles.toast,
                    {
                      backgroundColor: isError ? colors.card : colors.tealBg,
                      borderColor: isError ? colors.red : colors.teal,
                    },
                  ]}
                >
                  <Text
                    style={[styles.title, { color: isError ? colors.red : colors.text }]}
                  >
                    {toast.title}
                  </Text>
                  {toast.message ? (
                    <Text style={[styles.message, { color: colors.textMuted }]}>
                      {toast.message}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
