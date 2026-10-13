import * as SecureStore from 'expo-secure-store';
import {
  readNativeMeetingLink,
  rememberNativeInvitation,
  writeNativeMeetingLink,
} from './link-recovery';
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));
beforeEach(() => {
  jest.clearAllMocks();
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
