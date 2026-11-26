import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ProfileSettingsService } from './profile-settings.service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
const service = new ProfileSettingsService();
const valid = {
  firstName: 'Jane',
  lastName: 'Test',
  displayName: 'Jane T',
  themeKey: 'blue',
  timezone: 'UTC',
  locale: 'en-US',
  hideRole: false,
  hideStatus: false,
};
const rpc = jest.fn();
const serviceRpc = jest.fn();
const getUser = jest.fn();
const single = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single,
  };
  jest.mocked(createSupabaseSessionClient).mockReturnValue({
    rpc,
    auth: { getUser },
    from: () => query,
  } as unknown as ReturnType<typeof createSupabaseSessionClient>);
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue({ rpc: serviceRpc } as unknown as ReturnType<
      typeof createSupabaseServiceClient
    >);
  getUser.mockResolvedValue({ data: { user: { id: 'synthetic-user' } }, error: null });
  single.mockResolvedValue({
    data: { id: 'verified-account', org_id: 'org' },
    error: null,
  });
  serviceRpc.mockResolvedValue({ data: { id: 'profile' }, error: null });
});
it('uses the authenticated actor, ignoring a supplied actor field', async () => {
  await service.save('session', 'profile', {
    ...valid,
    actor_id: 'another-account',
  } as typeof valid);
  expect(serviceRpc).toHaveBeenCalledWith(
    'save_profile_settings',
    expect.objectContaining({ actor_id: 'verified-account', target_id: 'profile' }),
  );
  expect(serviceRpc.mock.calls[0][1].changes).not.toHaveProperty('actor_id');
});
it('cannot write without a verified session', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(service.save('session', 'profile', valid)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect(serviceRpc).not.toHaveBeenCalled();
});
it('preserves database permission failures', async () => {
  serviceRpc.mockResolvedValue({
    data: null,
    error: { code: '42501', message: 'denied' },
  });
  await expect(service.save('session', 'profile', valid)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
});
it('turns removal restrictions into actionable support instructions', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '23503', message: 'assigned' } });
  await expect(service.remove('session', 'profile')).rejects.toBeInstanceOf(
    ConflictException,
  );
  await expect(service.remove('session', 'profile')).rejects.toThrow('Live Support');
});
it('rejects photos outside the configured bucket/profile folder', async () => {
  await expect(
    service.save('session', 'profile', {
      ...valid,
      avatarUrl: 'https://example.invalid/photo.jpg',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(serviceRpc).not.toHaveBeenCalled();
});
