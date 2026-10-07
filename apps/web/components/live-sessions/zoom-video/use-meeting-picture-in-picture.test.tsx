import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMeetingPictureInPicture } from './use-meeting-picture-in-picture';

const initial = {
  connected: true,
  sharing: false,
  cameraActive: true,
  microphoneActive: true,
};
let frame: HTMLIFrameElement;
let target: Window;
let request: ReturnType<typeof vi.fn>;
let actions: Map<string, (() => void) | null>;

beforeEach(() => {
  localStorage.clear();
  frame = document.createElement('iframe');
  document.body.append(frame);
  target = frame.contentWindow!;
  vi.spyOn(target, 'close').mockImplementation(() => {
    target.dispatchEvent(new Event('pagehide'));
  });
  vi.spyOn(window, 'focus').mockImplementation(() => {});
  request = vi.fn().mockResolvedValue(target);
  Object.defineProperty(window, 'documentPictureInPicture', {
    configurable: true,
    value: { requestWindow: request },
  });
  actions = new Map();
  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: {
      setActionHandler: vi.fn((name: string, callback: (() => void) | null) =>
        actions.set(name, callback),
      ),
      setCameraActive: vi.fn().mockResolvedValue(undefined),
      setMicrophoneActive: vi.fn().mockResolvedValue(undefined),
    },
  });
});
afterEach(() => {
  frame.remove();
  vi.restoreAllMocks();
  delete window.documentPictureInPicture;
});

describe('meeting picture-in-picture lifecycle', () => {
  it('moves the same portal root and restores its live content when closed', async () => {
    const { result } = renderHook(() => useMeetingPictureInPicture(initial));
    const host = result.current.host!;
    const canvas = document.createElement('canvas');
    host.append(canvas);
    await act(() => result.current.open());
    expect(target.document.body.contains(host)).toBe(true);
    expect(host.firstChild).toBe(canvas);
    expect(result.current.pipWindow).toBe(target);
    act(() => result.current.restore());
    expect(host.parentElement).toBe(document.body);
    expect(host.firstChild).toBe(canvas);
    expect(result.current.pipWindow).toBeNull();
  });
  it('registers the supported browser automatic trigger and respects the preference', async () => {
    const { result } = renderHook(() => useMeetingPictureInPicture(initial));
    expect(actions.get('enterpictureinpicture')).toBeTypeOf('function');
    act(() => result.current.setAutomaticMode('never'));
    expect(actions.get('enterpictureinpicture')).toBeNull();
    expect(localStorage.getItem('meeting-automatic-pip')).toBe('never');
    act(() => result.current.setAutomaticMode('tabs'));
    await act(async () => actions.get('enterpictureinpicture')?.());
    expect(request).toHaveBeenCalledOnce();
  });
  it('does not open duplicate windows during concurrent requests', async () => {
    const { result } = renderHook(() => useMeetingPictureInPicture(initial));
    await act(async () => Promise.all([result.current.open(), result.current.open()]));
    expect(request).toHaveBeenCalledOnce();
  });
  it('keeps the call in place and reports a denied manual request', async () => {
    request.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const { result } = renderHook(() => useMeetingPictureInPicture(initial));
    await act(() => result.current.open());
    expect(result.current.host!.parentElement).toBe(document.body);
    expect(result.current.error).toMatch(/site settings/);
    expect(result.current.pipWindow).toBeNull();
  });
  it('offers a click after an automatic share request is denied', async () => {
    request.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const { result, rerender } = renderHook(
      (props) => useMeetingPictureInPicture(props),
      { initialProps: initial },
    );
    rerender({ ...initial, sharing: true });
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(result.current.sharePrompt).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.host!.parentElement).toBe(document.body);
  });
  it('shows a return notice when an automatically opened window closes', async () => {
    const { result } = renderHook(() => useMeetingPictureInPicture(initial));
    await act(() => result.current.open(true));
    act(() => target.close());
    expect(result.current.returned).toBe(true);
    expect(result.current.host!.parentElement).toBe(document.body);
  });
  it('closes and restores on disconnect and unregisters the browser action', async () => {
    const { result, rerender } = renderHook(
      (props) => useMeetingPictureInPicture(props),
      { initialProps: initial },
    );
    await act(() => result.current.open());
    rerender({ ...initial, connected: false });
    expect(target.close).toHaveBeenCalledOnce();
    expect(actions.get('enterpictureinpicture')).toBeNull();
    expect(result.current.pipWindow).toBeNull();
  });
  it('closes a pending request after unmount without reattaching the call', async () => {
    let resolve!: (value: Window) => void;
    request.mockImplementation(
      () =>
        new Promise<Window>((done) => {
          resolve = done;
        }),
    );
    const { result, unmount } = renderHook(() => useMeetingPictureInPicture(initial));
    const host = result.current.host!;
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.open();
    });
    unmount();
    await act(async () => {
      resolve(target);
      await pending;
    });
    expect(target.close).toHaveBeenCalledOnce();
    expect(document.body.contains(host)).toBe(false);
  });
  it('handles unsupported browsers without registering automatic entry', async () => {
    delete window.documentPictureInPicture;
    const { result } = renderHook(() => useMeetingPictureInPicture(initial));
    expect(actions.has('enterpictureinpicture')).toBe(false);
    await act(() => result.current.open());
    expect(result.current.error).toMatch(/supported desktop/);
  });
});
