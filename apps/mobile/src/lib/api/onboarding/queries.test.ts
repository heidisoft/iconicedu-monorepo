import {
  saveNameStep,
  saveLocationStep,
  fetchTimezoneLocationHint,
  completeParentRole,
} from './queries';
import { apiPut, apiGet, apiPost } from '@/lib/api/http-client';

jest.mock('@/lib/api/http-client', () => ({
  apiPut: jest.fn(),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));
jest.mock('@/lib/supabase/client', () => ({ supabase: {} }));

it('saves the chosen display name separately from the full name through the API', async () => {
  await saveNameStep('profile-1', ' Jane ', ' Smith ', ' Coach J ');
  expect(apiPut).toHaveBeenCalledWith('/profiles/profile-1', {
    firstName: 'Jane',
    lastName: 'Smith',
    displayName: 'Coach J',
  });
});

it('propagates save failures', async () => {
  jest.mocked(apiPut).mockRejectedValueOnce(new Error('Save failed'));
  await expect(saveNameStep('profile-1', 'Jane', 'Smith', 'Jane S')).rejects.toThrow(
    'Save failed',
  );
});

it('saves location through the API with a string ZIP code', async () => {
  await saveLocationStep('profile-1', ' New York ', ' NY ', ' 00501 ', 'US');
  expect(apiPut).toHaveBeenCalledWith('/profiles/profile-1/location', {
    city: 'New York',
    region: 'NY',
    postalCode: '00501',
    countryCode: 'US',
  });
});

it('requests timezone location details through the authenticated API client', async () => {
  await fetchTimezoneLocationHint('America/New_York');
  expect(apiGet).toHaveBeenCalledWith(
    '/profiles/location-hint?timezone=America%2FNew_York',
  );
});

it('passes an accepted referral to the owning role onboarding API', async () => {
  const referralCode = 'a'.repeat(48);
  await completeParentRole({ referralCode });
  expect(apiPost).toHaveBeenCalledWith('/onboarding/role', {
    role: 'parent',
    referralCode,
  });
});
