import { BadRequestException } from '@nestjs/common';
import type { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';
import { ProfilesService } from './profiles.service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const service = new ProfilesService({} as NotificationPreferencesService);

it('saves separate names using the authenticated session and profile filter', async () => {
  const single = jest.fn().mockResolvedValue({ data: { id: 'profile-1' }, error: null });
  const select = jest.fn().mockReturnValue({ single });
  const eq = jest.fn().mockReturnValue({ select });
  const update = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ update });
  jest
    .mocked(createSupabaseSessionClient)
    .mockReturnValue({ from } as unknown as ReturnType<
      typeof createSupabaseSessionClient
    >);
  await service.update('session-token', 'profile-1', {
    firstName: ' Jane ',
    lastName: ' Smith ',
    displayName: ' Coach J ',
  });
  expect(createSupabaseSessionClient).toHaveBeenCalledWith('session-token');
  expect(eq).toHaveBeenCalledWith('id', 'profile-1');
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      first_name: 'Jane',
      last_name: 'Smith',
      display_name: 'Coach J',
    }),
  );
});

it.each(['firstName', 'lastName', 'displayName'])(
  'rejects an empty %s',
  async (field) => {
    await expect(
      service.update('session-token', 'profile-1', { [field]: ' ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  },
);
