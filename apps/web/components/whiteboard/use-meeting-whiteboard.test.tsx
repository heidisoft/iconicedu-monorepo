import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMeetingWhiteboard } from './use-meeting-whiteboard';
import { useZoomWhiteboardFeature } from '../live-sessions/zoom-video/use-zoom-whiteboard-feature';
vi.mock('../live-sessions/zoom-video/use-zoom-whiteboard-feature', () => ({
  useZoomWhiteboardFeature: vi.fn(() => ({
    status: 0,
    supported: true,
    error: null,
    toggle: vi.fn(),
  })),
}));
describe('meeting whiteboard provider boundary', () => {
  it('defaults granted application boards to the native surface and leaves Zoom disabled', async () => {
    const { result } = renderHook(() =>
      useMeetingWhiteboard(null, true, 'session', null, {
        provider: 'excalidraw',
        token: 'capability',
      }),
    );
    expect(vi.mocked(useZoomWhiteboardFeature)).toHaveBeenLastCalledWith(
      null,
      false,
      'session',
      null,
    );
    await act(() => result.current.toggle());
    expect(result.current.status).toBe(2);
    expect(result.current.nativeToken).toBe('capability');
  });
  it('retains Zoom when selected, and contains an application provider failure', async () => {
    renderHook(() =>
      useMeetingWhiteboard(null, true, 'session', null, { provider: 'zoom' }),
    );
    expect(vi.mocked(useZoomWhiteboardFeature)).toHaveBeenLastCalledWith(
      null,
      true,
      'session',
      null,
    );
    const { result } = renderHook(() =>
      useMeetingWhiteboard(null, true, 'session', null, {
        provider: 'excalidraw',
        unavailable: true,
      }),
    );
    await act(() => result.current.toggle());
    expect(result.current.error).toContain('temporarily unavailable');
    expect(result.current.status).toBe(0);
  });
});
