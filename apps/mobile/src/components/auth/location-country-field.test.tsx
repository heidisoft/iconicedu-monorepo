import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocationCountryField } from './location-country-field';
import { lightColors } from '@/lib/theme';

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
  // The native sheet's leading close action precedes its centered title.
  const close = screen.getByLabelText('Close country picker');
  const title = screen.getByText('Choose country');
  let header = close.parent;
  while (header && header.findAll((node) => node === title).length === 0) {
    header = header.parent;
  }
  const actions = header?.findAll((node) => node === close || node === title);
  expect(actions?.[0]).toBe(close);
  expect(actions?.[1]).toBe(title);
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
