import { act, renderHook } from '@testing-library/react-native';
import { useNativeWhiteboardLasers } from './use-native-whiteboard-lasers';
import { capabilityGet, capabilityPost } from '@/lib/api/http-client';
jest.mock('@/lib/api/http-client', () => ({
  capabilityGet: jest.fn().mockResolvedValue([]),
  capabilityPost: jest.fn().mockResolvedValue(undefined),
}));
describe('native whiteboard laser transport', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());
  it('publishes bounded ephemeral samples through native capability transport and cleans up polling', async () => {
    const receive = jest.fn();
    const { result, unmount } = renderHook(() =>
      useNativeWhiteboardLasers('synthetic-capability', undefined, true, receive),
    );
    await act(async () => {
      for (let x = 0; x < 80; x++) result.current({ x, y: 2, button: 'down' });
      jest.advanceTimersByTime(100);
    });
    expect(capabilityPost).toHaveBeenCalledWith(
      '/whiteboards/current/laser',
      'synthetic-capability',
      expect.any(Array),
    );
    const samples = jest.mocked(capabilityPost).mock.calls[0][2] as unknown[];
    expect(samples).toHaveLength(64);
    expect(samples[0]).toMatchObject({ id: expect.any(String), x: 16 });
    unmount();
    const reads = jest.mocked(capabilityGet).mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(capabilityGet).toHaveBeenCalledTimes(reads);
    expect(receive).toHaveBeenLastCalledWith([]);
  });
  it('retries a lost laser response without writing drawing operations', async () => {
    jest.mocked(capabilityPost).mockRejectedValueOnce(new Error('network'));
    const receive = jest.fn();
    const { result, unmount } = renderHook(() =>
      useNativeWhiteboardLasers('synthetic-capability', undefined, true, receive),
    );
    await act(async () => {
      result.current({ x: 4, y: 5, button: 'up' });
      jest.advanceTimersByTime(100);
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(capabilityPost).toHaveBeenCalledTimes(2);
    expect(jest.mocked(capabilityPost).mock.calls[0]).toEqual(
      jest.mocked(capabilityPost).mock.calls[1],
    );
    unmount();
  });
  it('does not contact the API when the board is hidden', () => {
    renderHook(() =>
      useNativeWhiteboardLasers('synthetic-capability', undefined, false, jest.fn()),
    );
    expect(capabilityGet).not.toHaveBeenCalled();
    expect(capabilityPost).not.toHaveBeenCalled();
  });
});
