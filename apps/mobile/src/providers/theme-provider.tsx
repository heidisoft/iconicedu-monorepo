import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { useColorScheme, Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { lightColors, darkColors, type AppColors, type ThemeMode } from '@/lib/theme';

const STORAGE_KEY = 'app_theme_mode';

type ThemeContextType = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colorScheme: 'light' | 'dark';
  colors: AppColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  setMode: () => {},
  colorScheme: 'light',
  colors: lightColors,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // useColorScheme() returns null on Android before the first render on some
  // OS versions — fall back to Appearance.getColorScheme() which reads the
  // Android UiMode directly and is always non-null.
  const rnScheme = useColorScheme();
  const systemScheme: 'light' | 'dark' =
    (rnScheme ?? Appearance.getColorScheme() ?? 'light') as 'light' | 'dark';
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load persisted preference on mount. We render immediately with 'system'
  // mode (the default) so the native window background is never exposed as a
  // blank/white frame while SecureStore reads asynchronously.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const colorScheme: 'light' | 'dark' =
    mode === 'system' ? systemScheme : mode;
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  function setMode(newMode: ThemeMode) {
    setModeState(newMode);
    SecureStore.setItemAsync(STORAGE_KEY, newMode).catch(() => {});
  }

  const value = useMemo(
    () => ({ mode, setMode, colorScheme, colors, isDark }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, colorScheme, isDark],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
