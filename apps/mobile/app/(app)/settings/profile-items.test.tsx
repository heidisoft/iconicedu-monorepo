import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LocationScreen from './location';
import PreferencesScreen from './preferences';
const mockEdit = jest.fn();
let mockProfile: Record<string, unknown> = {
  id: 'p1',
  country_code: 'US',
  country_name: 'United States',
  city: 'Boston',
  region: 'Massachusetts',
  postal_code: '02108',
};
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('@/hooks/use-settings-profile', () => ({
  useSettingsProfile: () => ({ data: mockProfile, isPending: false, isError: false }),
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: require('@/lib/theme').lightColors,
    mode: 'system',
    colorScheme: 'light',
  }),
}));
jest.mock('@/components/profile/profile-item-editor', () => ({
  useProfileItemEditor: () => ({ edit: mockEdit, editor: null }),
}));
beforeEach(() => {
  mockEdit.mockClear();
});
it('opens each address row directly without any Edit action', () => {
  render(<LocationScreen />);
  expect(screen.queryByText('Edit')).toBeNull();
  for (const [label, field] of [
    ['Country', 'country_code'],
    ['Region / State', 'region'],
    ['City', 'city'],
    ['Postal Code', 'postal_code'],
  ]) {
    fireEvent.press(screen.getByLabelText(label!));
    expect(mockEdit).toHaveBeenLastCalledWith(field);
  }
});
it('starts country setup when tapping an address row on an empty profile', () => {
  mockProfile = { id: 'p1' };
  render(<LocationScreen />);
  fireEvent.press(screen.getByLabelText('City'));
  expect(mockEdit).toHaveBeenCalledWith('country_code');
});
it('opens each preference directly without section Edit actions', () => {
  render(<PreferencesScreen />);
  expect(screen.queryByText('Edit')).toBeNull();
  for (const [label, field] of [
    ['Theme', 'mode'],
    ['Accent Color', 'ui_theme_key'],
    ['Timezone', 'timezone'],
    ['Locale', 'locale'],
    ['Languages', 'languages_spoken'],
  ]) {
    fireEvent.press(screen.getByLabelText(label!));
    expect(mockEdit).toHaveBeenLastCalledWith(field);
  }
});
