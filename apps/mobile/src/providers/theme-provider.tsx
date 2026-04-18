import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Appearance, AppState } from 'react-native';
import { colorScheme as nwColorScheme } from 'react-native-css-interop';
import * as SecureStore from 'expo-secure-store';
import { lightColors, darkColors, type AppColors, type ThemeMode } from '@/lib/theme';

const STORAGE_KEY = 'app_theme_mode';

function readSystemColorScheme(): 'light' | 'dark' {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

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
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() =>
    readSystemColorScheme(),
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setSystemScheme(readSystemColorScheme());
      }
    });
    return () => sub.remove();
  }, []);

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

  useEffect(() => {
    nwColorScheme.set(colorScheme);
  }, [colorScheme]);

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
