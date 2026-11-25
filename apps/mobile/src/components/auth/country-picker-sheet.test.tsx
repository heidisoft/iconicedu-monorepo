import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  CountryPickerSheet,
  type CallingCountry,
} from '@iconicedu/ui-native/components/country-picker-sheet';
import { lightColors, darkColors } from '@/lib/theme';

const countries = [
  { code: 'US', label: 'United States', dialCode: '1' },
  { code: 'LK', label: 'Sri Lanka', dialCode: '94' },
  { code: 'CA', label: 'Canada', dialCode: '1' },
];

it.each([lightColors, darkColors])(
  'searches by name, ISO code, and calling code in either theme',
  (colors) => {
    render(
      <CountryPickerSheet
        visible
        countries={countries}
        selectedCode="US"
        colors={colors}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    const search = screen.getByLabelText('Search country or calling code');
    expect(
      screen
        .getAllByRole('button')
        .slice(1)
        .map((row) => row.props.accessibilityLabel),
    ).toEqual(['Canada, +1', 'Sri Lanka, +94', 'United States, +1']);
    fireEvent.changeText(search, ' sri ');
    expect(screen.getByText('Sri Lanka')).toBeTruthy();
    expect(screen.queryByText('United States')).toBeNull();
    fireEvent.changeText(search, '+94');
    expect(screen.getByText('Sri Lanka')).toBeTruthy();
    fireEvent.changeText(search, 'US');
    expect(screen.getByText('United States')).toBeTruthy();
    fireEvent.changeText(search, 'Atlantis');
    expect(
      screen.getByText('No countries found. Try a country name or calling code.'),
    ).toBeTruthy();
  },
);

it('marks the selected country and supports closing without selection', () => {
  const onClose = jest.fn();
  const onSelect = jest.fn();
  render(
    <CountryPickerSheet
      visible
      countries={countries}
      selectedCode="US"
      colors={lightColors}
      onSelect={onSelect}
      onClose={onClose}
    />,
  );
  expect(screen.getByLabelText('United States, +1').props.accessibilityState).toEqual({
    selected: true,
  });
  fireEvent.press(screen.getByLabelText('Close country picker'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
});

it('allows a selection with the search keyboard open and closes the sheet', () => {
  const onSelect = jest.fn();
  function Example() {
    const [selected, setSelected] = useState<CallingCountry | null>(null);
    return selected ? (
      <Text>{selected.label} selected</Text>
    ) : (
      <CountryPickerSheet
        visible
        countries={countries}
        selectedCode="US"
        colors={lightColors}
        onClose={jest.fn()}
        onSelect={(country) => {
          onSelect(country);
          setSelected(country);
        }}
      />
    );
  }
  render(<Example />);
  fireEvent.changeText(screen.getByLabelText('Search country or calling code'), '94');
  fireEvent.press(screen.getByLabelText('Sri Lanka, +94'));
  expect(onSelect).toHaveBeenCalledWith(countries[1]);
  expect(screen.queryByText('Choose country')).toBeNull();
  expect(screen.getByText('Sri Lanka selected')).toBeTruthy();
});
