import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useColorScheme } from 'react-native';
import { colorScheme as nwColorScheme } from 'react-native-css-interop';
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
  const [mode, setModeState] = useState<ThemeMode>('system');
  const systemScheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';

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

  const colorScheme: 'light' | 'dark' = mode === 'system' ? systemScheme : mode;
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // Pass 'system' when in system mode so NativeWind doesn't call
  // Appearance.setColorScheme() with a fixed value — that override blocks
  // OS-level trait-change notifications and breaks useColorScheme() live updates.
  useEffect(() => {
    nwColorScheme.set(mode === 'system' ? 'system' : mode);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    SecureStore.setItemAsync(STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, colorScheme, colors, isDark }),
    [mode, setMode, colorScheme, colors, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
