import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviewVideoEffects } from './use-preview-video-effects';

const native = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  updateVirtualBackground: vi.fn(),
  switchCamera: vi.fn(),
}));
vi.mock('@zoom/videosdk', () => ({ default: { createLocalVideoTrack: () => native } }));

describe('native preview backgrounds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    native.start.mockResolvedValue(undefined);
    native.stop.mockResolvedValue(undefined);
  });

  it('uses SDK segmentation and releases the camera before joining', async () => {
    const canvas = document.createElement('canvas');
    const { result, unmount } = renderHook(() =>
      usePreviewVideoEffects({ current: canvas }),
    );
    await act(async () => {
      await result.current.start('camera-one', 'blur');
    });
    expect(native.start).toHaveBeenCalledWith(canvas, {
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
      usePreviewVideoEffects({ current: document.createElement('canvas') }),
    );
    await act(async () => {
      await expect(result.current.start(undefined, 'blur')).rejects.toThrow(error);
    });
    expect(native.stop).toHaveBeenCalledOnce();
    expect(result.current.active).toBe(false);
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
      usePreviewVideoEffects({ current: document.createElement('canvas') }),
    );
    const pending = result.current.start(undefined, 'blur');
    await waitFor(() => expect(native.start).toHaveBeenCalledOnce());
    unmount();
    complete();
    await expect(pending).resolves.toBe(false);
    expect(native.stop).toHaveBeenCalled();
  });
});
