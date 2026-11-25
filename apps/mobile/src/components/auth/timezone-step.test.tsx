import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { TimezoneStep } from './timezone-step';
import { lightColors } from '@/lib/theme';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Lowest: 1 },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('./timezone-options', () => ({
  ...jest.requireActual('./timezone-options'),
  timezoneIds: () => ['UTC', 'America/New_York', 'Asia/Colombo'],
}));

const setTimezone = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(Location.getForegroundPermissionsAsync)
    .mockResolvedValue({ status: 'undetermined' } as Location.LocationPermissionResponse);
});

it('opens the city sheet when location was already denied and preserves selection on close', async () => {
  jest
    .mocked(Location.getForegroundPermissionsAsync)
    .mockResolvedValue({ status: 'denied' } as Location.LocationPermissionResponse);
  render(<TimezoneStep timezone="UTC" setTimezone={setTimezone} colors={lightColors} />);
  expect(await screen.findByText('Choose time zone')).toBeTruthy();
  expect(screen.getByText('New York')).toBeTruthy();
  expect(screen.queryByText('America/New_York')).toBeNull();
  fireEvent.press(screen.getByLabelText('Close time zone picker'));
  expect(screen.queryByText('Choose time zone')).toBeNull();
  expect(setTimezone).not.toHaveBeenCalled();
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

it('opens the same sheet when a new permission request is denied', async () => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ status: 'denied' } as Location.LocationPermissionResponse);
  render(<TimezoneStep timezone="UTC" setTimezone={setTimezone} colors={lightColors} />);
  fireEvent.press(screen.getByLabelText('Use my current location'));
  expect(await screen.findByText('Choose time zone')).toBeTruthy();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it('searches city and IANA ID, saves the selected ID, and closes', async () => {
  const onLocationDetected = jest.fn();
  function Example() {
    const [timezone, setValue] = useState('UTC');
    return (
      <TimezoneStep
        timezone={timezone}
        colors={lightColors}
        onLocationDetected={onLocationDetected}
        setTimezone={(value) => {
          setTimezone(value);
          setValue(value);
        }}
      />
    );
  }
  render(<Example />);
  await waitFor(() => expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled());
  fireEvent.press(screen.getByLabelText('Time zone: UTC. Change time zone'));
  const search = screen.getByLabelText('Search city or time zone');
  fireEvent.changeText(search, 'New York');
  expect(screen.getByText('New York')).toBeTruthy();
  expect(screen.queryByText('Colombo')).toBeNull();
  fireEvent.changeText(search, 'America/New_York');
  expect(screen.getByText('New York')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: /^New York, America, UTC/ }));
  expect(setTimezone).toHaveBeenCalledWith('America/New_York');
  expect(onLocationDetected).toHaveBeenCalledWith({
    city: 'New York',
    countryCode: 'US',
    region: '',
    postalCode: '',
  });
  expect(screen.queryByText('Choose time zone')).toBeNull();
  expect(screen.getByLabelText('Time zone: New York. Change time zone')).toBeTruthy();
});

it('keeps the device timezone without a popup when location lookup fails', async () => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockRejectedValue(new Error('Unavailable'));
  render(<TimezoneStep timezone="UTC" setTimezone={setTimezone} colors={lightColors} />);
  fireEvent.press(screen.getByLabelText('Use my current location'));
  await waitFor(() =>
    expect(setTimezone).toHaveBeenCalledWith(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  );
  expect(screen.queryByText('Choose time zone')).toBeNull();
  expect(
    screen.getByText(
      'Using your device time zone. Current location is unavailable; you can enter your address on the next step.',
    ),
  ).toBeTruthy();
});

it('keeps successful location detection and address prefill working', async () => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 1, longitude: 2 },
  } as Location.LocationObject);
  jest.mocked(Location.reverseGeocodeAsync).mockResolvedValue([
    {
      timezone: 'Asia/Colombo',
      city: 'Colombo',
      region: 'Western',
      postalCode: '00000',
      isoCountryCode: 'LK',
    } as Location.LocationGeocodedAddress,
  ]);
  const onLocationDetected = jest.fn();
  render(
    <TimezoneStep
      timezone="UTC"
      setTimezone={setTimezone}
      onLocationDetected={onLocationDetected}
      colors={lightColors}
    />,
  );
  fireEvent.press(screen.getByLabelText('Use my current location'));
  await waitFor(() => expect(setTimezone).toHaveBeenCalledWith('Asia/Colombo'));
  expect(onLocationDetected).toHaveBeenCalledWith({
    city: 'Colombo',
    region: 'Western',
    postalCode: '00000',
    countryCode: 'LK',
  });
  expect(screen.queryByText('Choose time zone')).toBeNull();
});

it('keeps a manual timezone selection when an earlier device lookup finishes later', async () => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse);
  let finish!: (value: Location.LocationObject) => void;
  jest.mocked(Location.getCurrentPositionAsync).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const onTimezoneSelected = jest.fn();
  render(
    <TimezoneStep
      timezone="UTC"
      setTimezone={setTimezone}
      onTimezoneSelected={onTimezoneSelected}
      colors={lightColors}
    />,
  );
  fireEvent.press(screen.getByLabelText('Use my current location'));
  await waitFor(() => expect(Location.getCurrentPositionAsync).toHaveBeenCalled());
  fireEvent.press(screen.getByLabelText('Time zone: UTC. Change time zone'));
  fireEvent.press(screen.getByRole('button', { name: /^Colombo, Asia, UTC/ }));
  finish({ coords: { latitude: 1, longitude: 2 } } as Location.LocationObject);
  await waitFor(() => expect(onTimezoneSelected).toHaveBeenCalledWith('Asia/Colombo'));
  expect(setTimezone).toHaveBeenCalledTimes(1);
  expect(setTimezone).toHaveBeenCalledWith('Asia/Colombo');
  expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
});

it('keeps a detected device timezone when only reverse geocoding fails', async () => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 1, longitude: 2 },
  } as Location.LocationObject);
  jest
    .mocked(Location.reverseGeocodeAsync)
    .mockRejectedValue(new Error('Geocoder unavailable'));
  render(<TimezoneStep timezone="UTC" setTimezone={setTimezone} colors={lightColors} />);
  fireEvent.press(screen.getByLabelText('Use my current location'));
  await waitFor(() =>
    expect(setTimezone).toHaveBeenCalledWith(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  );
  expect(screen.queryByText('Choose time zone')).toBeNull();
  expect(
    screen.getByText(
      'Time zone detected. Address details are unavailable; you can enter them on the next step.',
    ),
  ).toBeTruthy();
});

it('does not reopen the picker from a stale permission check after the user starts detection', async () => {
  let finish!: (value: Location.LocationPermissionResponse) => void;
  jest.mocked(Location.getForegroundPermissionsAsync).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 1, longitude: 2 },
  } as Location.LocationObject);
  jest.mocked(Location.reverseGeocodeAsync).mockResolvedValue([]);
  render(<TimezoneStep timezone="UTC" setTimezone={setTimezone} colors={lightColors} />);
  fireEvent.press(screen.getByLabelText('Use my current location'));
  await waitFor(() => expect(setTimezone).toHaveBeenCalled());
  await act(async () =>
    finish({ status: 'denied' } as Location.LocationPermissionResponse),
  );
  expect(screen.queryByText('Choose time zone')).toBeNull();
});

it('offers Settings when permission cannot be requested again', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: 'denied',
    canAskAgain: false,
  } as Location.LocationPermissionResponse);
  render(<TimezoneStep timezone="UTC" setTimezone={setTimezone} colors={lightColors} />);
  fireEvent.press(screen.getByLabelText('Use my current location'));
  expect(await screen.findByText('Choose time zone')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close time zone picker'));
  expect(screen.getByLabelText('Open location settings')).toBeTruthy();
});
