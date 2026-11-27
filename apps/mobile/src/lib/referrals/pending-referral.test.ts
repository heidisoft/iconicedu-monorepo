import * as SecureStore from 'expo-secure-store';
import {
  clearPendingParentReferral,
  parseParentReferralCode,
  readPendingParentReferral,
  savePendingParentReferral,
} from './pending-referral';
let mockValue: string | null = null;
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => mockValue),
  setItemAsync: jest.fn(async (_key: string, value: string) => {
    mockValue = value;
  }),
  deleteItemAsync: jest.fn(async () => {
    mockValue = null;
  }),
}));
const code = 'a'.repeat(48);
beforeEach(async () => {
  mockValue = null;
  await savePendingParentReferral(code, null);
  mockValue = null;
  jest.clearAllMocks();
});
it.each([
  code,
  `https://www.iconicedu.com/r/${code}`,
  `https://iconicedu.com/r/${code}?source=share`,
  `iconicedu://r/${code}`,
])('accepts only the invitation code from %s', (input) => {
  expect(parseParentReferralCode(input)).toBe(code);
});
it.each([
  'javascript:alert(1)',
  '../../admin',
  'a'.repeat(47),
  `https://example.com/elsewhere/${code}`,
  `iconicedu://auth/${code}`,
])('rejects malformed invitation %s', (input) => {
  expect(parseParentReferralCode(input)).toBeNull();
});
it('persists an anonymous invitation across restart and binds it to the first verified account', async () => {
  await savePendingParentReferral(code, null);
  expect((await readPendingParentReferral('new-parent'))?.ownerId).toBe('new-parent');
  expect((await readPendingParentReferral('new-parent'))?.code).toBe(code);
  expect(await readPendingParentReferral('another-account')).toBeNull();
  expect(mockValue).toBeNull();
});
it('expires invitations after 30 days', async () => {
  mockValue = JSON.stringify({
    code,
    ownerId: null,
    savedAt: Date.now() - 31 * 86400000,
  });
  expect(await readPendingParentReferral('new-parent')).toBeNull();
});
it.each([
  'invalid-json',
  JSON.stringify({ code: 'bad', savedAt: Date.now(), ownerId: null }),
  JSON.stringify({ code, savedAt: Date.now() + 86400000, ownerId: null }),
])('discards corrupted or future-dated storage', async (value) => {
  mockValue = value;
  expect(await readPendingParentReferral('parent')).toBeNull();
});
it('does not silently lose an invitation when secure storage fails', async () => {
  jest
    .mocked(SecureStore.setItemAsync)
    .mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(savePendingParentReferral(code, null)).rejects.toThrow(
    'Storage unavailable',
  );
});
it('removes an invitation after it is consumed or explicitly removed', async () => {
  await savePendingParentReferral(code, 'parent');
  await clearPendingParentReferral();
  expect(await readPendingParentReferral('parent')).toBeNull();
});

it('does not clear a newer invitation when an older signup request finishes', async () => {
  await savePendingParentReferral('b'.repeat(48), 'parent');
  await clearPendingParentReferral({ code, ownerId: 'parent' });
  expect((await readPendingParentReferral('parent'))?.code).toBe('b'.repeat(48));
});

it('serializes cancellation after an in-flight write so a late save cannot resurrect the invitation', async () => {
  let finish!: () => void;
  jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(async (_key, value) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    mockValue = value;
  });
  const save = savePendingParentReferral(code, null);
  await Promise.resolve();
  await Promise.resolve();
  const cancel = clearPendingParentReferral();
  finish();
  expect(await save).toBe(false);
  await cancel;
  expect(await readPendingParentReferral('new-parent')).toBeNull();
});
it('writes a durable cancellation tombstone if deleting storage fails', async () => {
  await savePendingParentReferral(code, null);
  jest
    .mocked(SecureStore.deleteItemAsync)
    .mockRejectedValueOnce(new Error('Delete failed'));
  await clearPendingParentReferral();
  expect(JSON.parse(mockValue!)).toEqual({ cancelled: true });
  expect(await readPendingParentReferral('new-parent')).toBeNull();
});
it('permits a new explicit acceptance after cancellation', async () => {
  await savePendingParentReferral(code, null);
  await clearPendingParentReferral();
  expect(await savePendingParentReferral(code, null)).toBe(true);
  expect((await readPendingParentReferral('new-parent'))?.code).toBe(code);
});
it('invalidates in memory even when both deletion and tombstone persistence fail', async () => {
  await savePendingParentReferral(code, null);
  jest
    .mocked(SecureStore.deleteItemAsync)
    .mockRejectedValueOnce(new Error('Delete failed'));
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Write failed'));
  await expect(clearPendingParentReferral()).rejects.toThrow('Write failed');
  expect(await readPendingParentReferral('new-parent')).toBeNull();
});
