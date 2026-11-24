import type { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { ProfilesService } from './profiles.service';

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
const service = new ProfilesService({} as NotificationPreferencesService);
beforeEach(() => jest.clearAllMocks());
it('saves normalized location with the session and live profile id filter', async () => {
  const chain = {
    update: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    select: jest.fn(),
    single: jest.fn().mockResolvedValue({ data: { id: 'profile-1' }, error: null }),
  };
  for (const method of ['update', 'eq', 'is', 'select'] as const)
    chain[method].mockReturnValue(chain);
  const from = jest.fn().mockReturnValue(chain);
  jest
    .mocked(createSupabaseSessionClient)
    .mockReturnValue({ from } as unknown as ReturnType<
      typeof createSupabaseSessionClient
    >);
  await service.updateLocation('session-token', 'profile-1', {
    countryCode: 'US',
    city: ' New York ',
    region: ' NY ',
    postalCode: '00501',
  });
  expect(createSupabaseSessionClient).toHaveBeenCalledWith('session-token');
  expect(chain.eq).toHaveBeenCalledWith('id', 'profile-1');
  expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
  expect(chain.update).toHaveBeenCalledWith(
    expect.objectContaining({
      country_code: 'US',
      city: 'New York',
      region: 'New York',
      postal_code: '00501',
    }),
  );
});
it('rejects a missing US ZIP before contacting the database', async () => {
  await expect(
    service.updateLocation('session-token', 'profile-1', {
      countryCode: 'US',
      city: 'New York',
      region: 'NY',
    }),
  ).rejects.toThrow('zip code');
  expect(createSupabaseSessionClient).not.toHaveBeenCalled();
});
