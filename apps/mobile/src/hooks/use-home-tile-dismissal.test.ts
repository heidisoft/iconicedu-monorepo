import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useHomeTileDismissal } from './use-home-tile-dismissal';
const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGet(...args),
  setItem: (...args: unknown[]) => mockSet(...args),
}));
beforeEach(() => {
  mockGet.mockReset().mockResolvedValue(null);
  mockSet.mockReset().mockResolvedValue(undefined);
});
it('waits for persisted state, then saves an independent dismissal', async () => {
  const { result } = renderHook(() => useHomeTileDismissal('org:parent', 'add-child'));
  expect(result.current.visible).toBe(false);
  await waitFor(() => expect(result.current.visible).toBe(true));
  await act(() => result.current.dismiss());
  expect(mockSet).toHaveBeenCalledWith('home-tile-v1:org:parent:add-child', '1');
  expect(result.current.visible).toBe(false);
});
it('keeps a dismissed tile hidden after remounting', async () => {
  mockGet.mockResolvedValue('1');
  const { result } = renderHook(() => useHomeTileDismissal('org:parent', 'refer-parent'));
  await waitFor(() => expect(mockGet).toHaveBeenCalled());
  expect(result.current.visible).toBe(false);
});
it('does not show the prior parent’s state while another scope is loading', async () => {
  const { result, rerender } = renderHook(
    ({ scope }) => useHomeTileDismissal(scope, 'add-child'),
    { initialProps: { scope: 'org:a' } },
  );
  await waitFor(() => expect(result.current.visible).toBe(true));
  let resolve!: (value: string | null) => void;
  mockGet.mockReturnValue(
    new Promise<string | null>((done) => {
      resolve = done;
    }),
  );
  rerender({ scope: 'org:b' });
  expect(result.current.visible).toBe(false);
  await act(async () => resolve('1'));
  expect(result.current.visible).toBe(false);
});
it('keeps the tile available when saving fails, so dismissal can be retried', async () => {
  mockSet.mockRejectedValue(new Error('offline storage'));
  const { result } = renderHook(() => useHomeTileDismissal('org:parent', 'add-child'));
  await waitFor(() => expect(result.current.visible).toBe(true));
  await act(async () => {
    await expect(result.current.dismiss()).rejects.toThrow('offline storage');
  });
  expect(result.current.visible).toBe(true);
  expect(result.current.saving).toBe(false);
});
it('shows the tile if the stored preference cannot be read', async () => {
  mockGet.mockRejectedValue(new Error('storage unavailable'));
  const { result } = renderHook(() => useHomeTileDismissal('org:parent', 'add-child'));
  await waitFor(() => expect(result.current.visible).toBe(true));
});
