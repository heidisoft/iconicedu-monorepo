import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase/client';
import { nativeAdmissionToken } from './admission-recovery';
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));
jest.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));
beforeEach(() => {
  jest.resetAllMocks();
  jest
    .mocked(Crypto.randomUUID)
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValue('00000000-0000-4000-8000-000000000002');
  jest
    .mocked(supabase.auth.getSession)
    .mockResolvedValue({ data: { session: null }, error: null });
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
});
it('sends a valid token on the first request and recovers it across remounts', async () => {
  const first = await nativeAdmissionToken(
    'meeting',
    'Test guest',
    undefined,
    'synthetic-invite',
  );
  expect(first).toMatch(/^[\w-]{32}$/);
  const [, stored, options] = jest.mocked(SecureStore.setItemAsync).mock.calls[0];
  expect(options).toEqual({ keychainAccessible: 'device-only' });
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(stored);
  expect(
    await nativeAdmissionToken('meeting', 'Test guest', undefined, 'synthetic-invite'),
  ).toBe(first);
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  expect(
    await nativeAdmissionToken('meeting', 'Other guest', undefined, 'synthetic-invite'),
  ).not.toBe(first);
});
it('never reuses an expired or corrupted request identity', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
    JSON.stringify({
      identity: JSON.stringify([null, 'Test guest', null, null]),
      token: 'x'.repeat(32),
      expiresAt: 1,
    }),
  );
  expect(await nativeAdmissionToken('meeting', 'Test guest')).not.toBe('x'.repeat(32));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('{broken');
  expect(await nativeAdmissionToken('meeting', 'Test guest')).toMatch(/^[\w-]{32}$/);
});

it('rotates request identity when the signed-in account changes', async () => {
  const first = await nativeAdmissionToken('meeting', 'Same name');
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(jest.mocked(SecureStore.setItemAsync).mock.calls[0][1]);
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: 'another-test-account' } } },
    error: null,
  } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  expect(await nativeAdmissionToken('meeting', 'Same name')).not.toBe(first);
});

it('binds approval recovery to the complete student set, independent of selection order', async () => {
  const first = await nativeAdmissionToken('meeting', 'Parent', [
    'student-one',
    'student-two',
  ]);
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(jest.mocked(SecureStore.setItemAsync).mock.calls[0][1]);
  expect(
    await nativeAdmissionToken('meeting', 'Parent', ['student-two', 'student-one']),
  ).toBe(first);
  expect(await nativeAdmissionToken('meeting', 'Parent', 'student-one')).not.toBe(first);
});
