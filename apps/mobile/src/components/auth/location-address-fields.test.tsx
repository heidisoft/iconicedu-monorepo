import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocationAddressFields } from './location-address-fields';

const props = {
  city: '',
  region: '',
  postalCode: '',
  setCity: jest.fn(),
  setRegion: jest.fn(),
  setPostalCode: jest.fn(),
  s: {
    label: {},
    labelOptional: {},
    inputWrap: {},
    inputWrapFocused: {},
    input: {},
    placeholderColor: 'gray',
  },
};
it('shows US city, state and required ZIP and keeps it a string', () => {
  render(<LocationAddressFields {...props} countryCode="US" />);
  expect(screen.getByLabelText('City')).toBeTruthy();
  expect(screen.getByLabelText('State')).toBeTruthy();
  expect(screen.getByLabelText('ZIP code')).toBeTruthy();
  expect(screen.queryByText(/optional/)).toBeNull();
  expect(screen.getByLabelText('City').props.returnKeyType).toBe('done');
  fireEvent.changeText(screen.getByLabelText('ZIP code'), '00501');
  expect(props.setPostalCode).toHaveBeenCalledWith('00501');
});
it('updates visible fields and labels with country selection', () => {
  const { rerender } = render(<LocationAddressFields {...props} countryCode="CA" />);
  expect(screen.getByLabelText('Province')).toBeTruthy();
  expect(screen.getByLabelText('Postal code')).toBeTruthy();
  rerender(<LocationAddressFields {...props} countryCode="GB" />);
  expect(screen.getByLabelText('Postcode')).toBeTruthy();
  expect(screen.queryByLabelText('Province')).toBeNull();
  rerender(<LocationAddressFields {...props} countryCode="AE" />);
  expect(screen.getByLabelText('Emirate')).toBeTruthy();
  expect(screen.queryByLabelText('Postcode')).toBeNull();
  rerender(<LocationAddressFields {...props} countryCode="SG" />);
  expect(screen.getByLabelText('Postal code')).toBeTruthy();
  expect(screen.queryByLabelText('City')).toBeNull();
});
it('marks optional Sri Lankan postal code clearly', () => {
  render(<LocationAddressFields {...props} countryCode="LK" />);
  expect(screen.getByText(/optional/)).toBeTruthy();
});
it('disables address entry and the region picker while saving', () => {
  render(<LocationAddressFields {...props} countryCode="US" disabled />);
  expect(screen.getByLabelText('City').props.editable).toBe(false);
  expect(screen.getByLabelText('ZIP code').props.editable).toBe(false);
  fireEvent.press(screen.getByLabelText('State'));
  expect(screen.queryByLabelText('Search state')).toBeNull();
});
