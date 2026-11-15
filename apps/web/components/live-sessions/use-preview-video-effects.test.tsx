import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviewVideoEffects } from './use-preview-video-effects';

const native = vi.hoisted(() => ({
  init: vi.fn(),
  supported: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  updateVirtualBackground: vi.fn(),
  switchCamera: vi.fn(),
}));
vi.mock('@zoom/videosdk', () => ({
  default: {
    createLocalVideoTrack: () => native,
    createClient: () => ({
      init: native.init,
      getMediaStream: () => ({ isSupportVirtualBackground: native.supported }),
    }),
  },
}));

describe('native preview backgrounds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    native.init.mockResolvedValue(undefined);
    native.supported.mockReturnValue(true);
    native.start.mockResolvedValue(undefined);
    native.stop.mockResolvedValue(undefined);
  });

  it('uses SDK segmentation and releases the camera before joining', async () => {
    const surface = document.createElement('div');
    const { result, unmount } = renderHook(() =>
      usePreviewVideoEffects({ current: surface }),
    );
    await act(async () => {
      await result.current.start('camera-one', 'blur');
    });
    expect(native.init).toHaveBeenCalledWith('en-US', 'Global', {
      patchJsMedia: true,
      enforceVirtualBackground: true,
    });
    expect(native.init.mock.invocationCallOrder[0]).toBeLessThan(
      native.start.mock.invocationCallOrder[0],
    );
    expect(surface.querySelector('video-player-container > video-player')).toBeTruthy();
    expect(native.start).toHaveBeenCalledWith(surface.querySelector('video-player'), {
      imageUrl: 'blur',
      cropped: true,
    });
    expect(result.current.active).toBe(true);
    await act(async () => {
      await result.current.background('none');
    });
    expect(native.updateVirtualBackground).toHaveBeenCalledWith(undefined, true);
    await act(async () => {
      await result.current.camera('camera-two');
    });
    expect(native.switchCamera).toHaveBeenCalledWith('camera-two');
    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.active).toBe(false);
    unmount();
    expect(native.stop).toHaveBeenCalledOnce();
  });

  it('cleans up SDK errors returned as values, allowing browser camera fallback', async () => {
    const error = new Error('Background unavailable');
    native.start.mockResolvedValue(error);
    const { result } = renderHook(() =>
      usePreviewVideoEffects({ current: document.createElement('div') }),
    );
    await act(async () => {
      await expect(result.current.start(undefined, 'blur')).rejects.toThrow(error);
    });
    expect(native.stop).toHaveBeenCalledOnce();
    expect(result.current.active).toBe(false);
  });

  it('does not report success when Zoom returns a structured media failure', async () => {
    const failure = {
      type: 'INVALID_OPERATION',
      reason: 'Virtual background is not supported on the current platform',
    };
    native.start.mockResolvedValue(failure);
    const { result } = renderHook(() =>
      usePreviewVideoEffects({ current: document.createElement('div') }),
    );
    await act(async () => {
      await expect(result.current.start(undefined, 'blur')).rejects.toEqual(failure);
    });
    expect(result.current.active).toBe(false);
    expect(native.stop).toHaveBeenCalledOnce();
  });

  it('retries initialization after failure without capturing the camera early', async () => {
    native.init.mockRejectedValueOnce(new Error('Assets unavailable'));
    const { result } = renderHook(() =>
      usePreviewVideoEffects({ current: document.createElement('div') }),
    );
    await act(async () => {
      await expect(result.current.start(undefined, 'blur')).rejects.toThrow(
        'Assets unavailable',
      );
    });
    expect(native.start).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.start(undefined, 'blur');
    });
    expect(native.init).toHaveBeenCalledTimes(2);
    expect(result.current.active).toBe(true);
  });

  it('releases a pending capture when the preview unmounts', async () => {
    let complete!: () => void;
    native.start.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const { result, unmount } = renderHook(() =>
      usePreviewVideoEffects({ current: document.createElement('div') }),
    );
    const pending = result.current.start(undefined, 'blur');
    await waitFor(() => expect(native.start).toHaveBeenCalledOnce());
    unmount();
    complete();
    await expect(pending).resolves.toBe(false);
    expect(native.stop).toHaveBeenCalled();
  });
});
