import { apiPublicGet, ApiError } from './http-client';
jest.mock('@/lib/supabase/client', () => ({ supabase: {} }));
const previousUrl = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.invalid';
});
afterEach(() => {
  jest.restoreAllMocks();
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousUrl;
});
it('resolves public invitations before login without sending authentication credentials', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ referrerName: 'Test Parent' }),
  } as Response);
  await expect(apiPublicGet('/referrals/links/opaque')).resolves.toEqual({
    referrerName: 'Test Parent',
  });
  expect(fetchSpy).toHaveBeenCalledWith(
    'https://api.example.invalid/referrals/links/opaque',
    { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
  );
});
it('distinguishes a disabled or revoked referral from a transient network failure', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: false,
    status: 404,
    json: async () => ({ message: 'Unavailable' }),
  } as Response);
  await expect(apiPublicGet('/referrals/links/opaque')).rejects.toEqual(
    new ApiError('Unavailable', 404),
  );
});
