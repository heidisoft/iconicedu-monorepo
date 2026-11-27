import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocationRegionField } from './location-region-field';

it('recognizes an abbreviated GPS region and offers a searchable state list', () => {
  const onChange = jest.fn();
  render(
    <LocationRegionField countryCode="US" value="NY" label="State" onChange={onChange} />,
  );
  expect(screen.getByLabelText('State').props.accessibilityValue.text).toBe('New York');
  fireEvent.press(screen.getByLabelText('State'));
  fireEvent.changeText(screen.getByLabelText('Search state'), 'CA');
  fireEvent.press(screen.getByLabelText('California'));
  expect(onChange).toHaveBeenCalledWith('California');
  expect(screen.queryByText('Choose state')).toBeNull();
});
it('uses the country-specific province list and leaves the selection on dismissal', () => {
  const onChange = jest.fn();
  render(
    <LocationRegionField
      countryCode="CA"
      value="ON"
      label="Province"
      onChange={onChange}
    />,
  );
  fireEvent.press(screen.getByLabelText('Province'));
  expect(screen.getByLabelText('Ontario').props.accessibilityState.selected).toBe(true);
  expect(screen.queryByLabelText('California')).toBeNull();
  fireEvent.press(screen.getByLabelText('Close province picker'));
  expect(onChange).not.toHaveBeenCalled();
});
it('does not open the region picker while saving', () => {
  const onChange = jest.fn();
  render(
    <LocationRegionField
      countryCode="US"
      value="NY"
      label="State"
      onChange={onChange}
      disabled
    />,
  );
  fireEvent.press(screen.getByLabelText('State'));
  expect(screen.queryByText('Choose state')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});
