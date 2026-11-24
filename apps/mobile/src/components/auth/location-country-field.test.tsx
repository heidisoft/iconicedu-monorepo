import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocationCountryField } from './location-country-field';
import { lightColors } from '@/lib/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
const countries = [
  { code: 'US', label: 'United States' },
  { code: 'LK', label: 'Sri Lanka' },
];

it('opens a searchable country list, selects the country code, and closes', () => {
  const onChange = jest.fn();
  render(
    <LocationCountryField
      countries={countries}
      countryCode="US"
      onChange={onChange}
      colors={lightColors}
    />,
  );
  fireEvent.press(screen.getByLabelText('Country: United States. Change country'));
  expect(screen.getByText('Choose country')).toBeTruthy();
  expect(screen.getByLabelText('United States').props.accessibilityState).toEqual({
    selected: true,
  });
  fireEvent.changeText(screen.getByLabelText('Search country'), 'Sri');
  expect(screen.queryByLabelText('United States')).toBeNull();
  fireEvent.press(screen.getByLabelText('Sri Lanka'));
  expect(onChange).toHaveBeenCalledWith('LK');
  expect(screen.queryByText('Choose country')).toBeNull();
});

it('keeps the selection on close and starts a fresh search when reopened', () => {
  const onChange = jest.fn();
  render(
    <LocationCountryField
      countries={countries}
      countryCode="US"
      onChange={onChange}
      colors={lightColors}
    />,
  );
  const trigger = screen.getByLabelText('Country: United States. Change country');
  fireEvent.press(trigger);
  fireEvent.changeText(screen.getByLabelText('Search country'), 'Unknown');
  expect(screen.getByText('No countries found. Try another country name.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close country picker'));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(trigger);
  expect(screen.getByLabelText('Search country').props.value).toBe('');
  expect(screen.getByLabelText('United States')).toBeTruthy();
});
