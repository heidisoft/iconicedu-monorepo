import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useColorScheme as useNativeWindColorScheme } from 'react-native-css-interop';
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
  const { colorScheme: nativeWindColorScheme, setColorScheme: setNativeWindColorScheme } =
    useNativeWindColorScheme();

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
    nativeWindColorScheme === 'dark' ? 'dark' : 'light';
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // Keep NativeWind class styles and ThemeContext colors on the same effective
  // color scheme. Use css-interop directly because NativeWind's wrapper can
  // throw before the compiled darkMode flag is available in Expo startup.
  useEffect(() => {
    setNativeWindColorScheme(mode);
  }, [mode, setNativeWindColorScheme]);

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
