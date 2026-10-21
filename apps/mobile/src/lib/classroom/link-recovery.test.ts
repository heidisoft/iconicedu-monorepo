import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  nativeHandoffRedemptionKey,
  readNativeMeetingLink,
  rememberNativeInvitation,
  writeNativeMeetingLink,
} from './link-recovery';
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(Crypto.randomUUID)
    .mockReset()
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValue('00000000-0000-4000-8000-000000000002');
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
});
it('persists invitations and guest names encrypted without storing passcodes or SDK JWTs', async () => {
  await rememberNativeInvitation('aaaa-bbbb-cccc', 'synthetic-invitation');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'classroom.link.aaaa-bbbb-cccc',
    expect.any(String),
    { keychainAccessible: 'device-only' },
  );
  const stored = JSON.parse(jest.mocked(SecureStore.setItemAsync).mock.calls[0][1]);
  expect(stored).toEqual({
    token: 'synthetic-invitation',
    expiresAt: expect.any(Number),
  });
  await writeNativeMeetingLink('aaaa-bbbb-cccc', { ...stored, displayName: 'Guest' });
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(JSON.stringify({ ...stored, displayName: 'Guest' }));
  await expect(readNativeMeetingLink('aaaa-bbbb-cccc')).resolves.toMatchObject({
    displayName: 'Guest',
  });
});
it('removes expired and corrupted recovery data', async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(JSON.stringify({ token: 'synthetic', expiresAt: Date.now() - 1 }));
  await expect(readNativeMeetingLink('test')).resolves.toBeNull();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('classroom.link.test');
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('{broken');
  await expect(readNativeMeetingLink('test')).resolves.toBeNull();
});

it('reuses a securely persisted handoff retry identity after a lost response', async () => {
  const value = await nativeHandoffRedemptionKey('test', 'synthetic-handoff');
  expect(value).toMatch(/^[a-f0-9]{32}$/i);
  const stored = jest.mocked(SecureStore.setItemAsync).mock.calls[0][1];
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(stored);
  await expect(nativeHandoffRedemptionKey('test', 'synthetic-handoff')).resolves.toBe(
    value,
  );
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  await expect(nativeHandoffRedemptionKey('test', 'other-handoff')).resolves.not.toBe(
    value,
  );
});
