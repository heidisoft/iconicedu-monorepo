import {
  APP_COLOR_THEME,
  APP_LAYOUT,
  NAV_THEME,
  THEME,
} from '@iconicedu/ui-native/theme';

export const lightColors = APP_COLOR_THEME.light;
export const darkColors = APP_COLOR_THEME.dark;

export const appLayout = APP_LAYOUT;
export { NAV_THEME, THEME };

export type AppColors = {
  [Key in keyof typeof lightColors]: string;
};
export type ThemeMode = 'system' | 'light' | 'dark';
