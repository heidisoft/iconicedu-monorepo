import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RegionalFields } from './regional-fields';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('@/lib/theme').lightColors }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@/components/auth/timezone-options', () => ({
  timezoneIds: () => ['UTC', 'America/New_York'],
  timezoneOption: (id: string) => ({ id, label: id }),
}));
jest.mock('@iconicedu/ui-native/components/searchable-selection-sheet', () => ({
  SearchableSelectionSheet: ({
    onSelect,
    options,
  }: {
    onSelect: (option: { id: string }) => void;
    options: { id: string }[];
  }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable
        accessibilityLabel="Select picker option"
        onPress={() => onSelect(options[1]!)}
      >
        <Text>Select</Text>
      </Pressable>
    );
  },
}));
it('selects a timezone and a language/region using native selection sheets', () => {
  const setTimezone = jest.fn();
  const setLocale = jest.fn();
  render(
    <RegionalFields
      timezone="UTC"
      locale="en-US"
      setTimezone={setTimezone}
      setLocale={setLocale}
      languages="English"
      setLanguages={jest.fn()}
      disabled={false}
    />,
  );
  fireEvent.press(screen.getByLabelText('Choose Time Zone'));
  fireEvent.press(screen.getByLabelText('Select picker option'));
  expect(setTimezone).toHaveBeenCalledWith('America/New_York');
  fireEvent.press(screen.getByLabelText('Choose Language / Region'));
  fireEvent.press(screen.getByLabelText('Select picker option'));
  expect(setLocale).toHaveBeenCalledWith('en-GB');
});
it('allows editing spoken languages and disables inputs during a save', () => {
  const setLanguages = jest.fn();
  const props = {
    timezone: 'UTC',
    locale: 'en-US',
    setTimezone: jest.fn(),
    setLocale: jest.fn(),
    languages: 'English',
    setLanguages,
    disabled: false,
  };
  const view = render(<RegionalFields {...props} />);
  fireEvent.changeText(screen.getByLabelText('Languages spoken'), 'English, Sinhala');
  expect(setLanguages).toHaveBeenCalledWith('English, Sinhala');
  view.rerender(<RegionalFields {...props} disabled />);
  expect(screen.getByLabelText('Languages spoken').props.editable).toBe(false);
  expect(
    screen.getByLabelText('Choose Time Zone').props.accessibilityState.disabled,
  ).toBe(true);
});
