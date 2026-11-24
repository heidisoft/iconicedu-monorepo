import { act, renderHook } from '@testing-library/react-native';
import { useOnboardingLocation } from './use-onboarding-location';

it('fills all available location details and replaces the initial US country default', () => {
  const { result } = renderHook(() => useOnboardingLocation());
  act(() =>
    result.current.prefillLocation({
      city: 'Colombo',
      region: 'Western',
      postalCode: '00000',
      countryCode: 'LK',
    }),
  );
  expect(result.current).toEqual(
    expect.objectContaining({
      city: 'Colombo',
      region: 'Western',
      postalCode: '00000',
      countryCode: 'LK',
    }),
  );
});

it('preserves manually edited fields when a new suggestion arrives', () => {
  const { result } = renderHook(() => useOnboardingLocation());
  act(() => {
    result.current.setCountryCode('CA');
    result.current.setCity('My city');
    result.current.setRegion('My state');
    result.current.setPostalCode('12345');
  });
  act(() =>
    result.current.prefillLocation({
      city: 'Colombo',
      region: 'Western',
      postalCode: '00000',
      countryCode: 'LK',
    }),
  );
  expect(result.current).toEqual(
    expect.objectContaining({
      city: 'My city',
      region: 'My state',
      postalCode: '12345',
      countryCode: 'CA',
    }),
  );
});

it('updates earlier suggestions and clears stale address details when the suggested city changes', () => {
  const { result } = renderHook(() => useOnboardingLocation());
  act(() =>
    result.current.prefillLocation({
      city: 'Colombo',
      region: 'Western',
      postalCode: '00000',
      countryCode: 'LK',
    }),
  );
  act(() => result.current.prefillLocation({ city: 'New York', countryCode: 'US' }));
  expect(result.current).toEqual(
    expect.objectContaining({
      city: 'New York',
      countryCode: 'US',
      region: '',
      postalCode: '',
    }),
  );
});

it('maps device region abbreviations to picker labels', () => {
  const { result } = renderHook(() => useOnboardingLocation());
  act(() =>
    result.current.prefillLocation({
      countryCode: 'US',
      city: 'New York',
      region: 'NY',
      postalCode: '10001',
    }),
  );
  expect(result.current.region).toBe('New York');
});
it('restores an existing country and region together without clearing the saved region', () => {
  const { result } = renderHook(() => useOnboardingLocation());
  act(() =>
    result.current.restoreLocation({
      countryCode: 'CA',
      city: 'Toronto',
      region: 'Ontario',
    }),
  );
  expect(result.current.region).toBe('Ontario');
  act(() => result.current.setCountryCode('US'));
  expect(result.current.region).toBe('');
});
