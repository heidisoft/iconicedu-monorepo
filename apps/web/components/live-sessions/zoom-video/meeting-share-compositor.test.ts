import { afterEach, expect, it, vi } from 'vitest';
import {
  MeetingShareCompositor,
  RecordingContentError,
} from './meeting-share-compositor';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
type Stream = ReturnType<ZoomClient['getMediaStream']>;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function stream() {
  const processor = {
    port: {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  };
  return {
    processor,
    isSupportShareProcessor: vi.fn(() => true),
    createProcessor: vi.fn(async () => processor),
    addProcessor: vi.fn(async () => ''),
    removeProcessor: vi.fn(async () => ''),
    stopShareScreen: vi.fn(async (): Promise<'' | Error> => ''),
  };
}
it('shares a single processor preparation and removes it when the call ends', async () => {
  const sdk = stream();
  const compositor = new MeetingShareCompositor(
    sdk as unknown as Stream,
    () => null,
    vi.fn(),
  );
  await Promise.all([compositor.prepare(), compositor.prepare()]);
  expect(sdk.createProcessor).toHaveBeenCalledOnce();
  expect(sdk.addProcessor).toHaveBeenCalledOnce();
  compositor.setMode('whiteboard');
  expect(sdk.processor.port.postMessage).toHaveBeenLastCalledWith({
    type: 'mode',
    mode: 'whiteboard',
  });
  await compositor.dispose();
  expect(sdk.removeProcessor).toHaveBeenCalledWith(sdk.processor);
});
it('reports unsupported media processing instead of claiming canvas content is recorded', async () => {
  const sdk = stream();
  sdk.isSupportShareProcessor.mockReturnValue(false);
  const compositor = new MeetingShareCompositor(
    sdk as unknown as Stream,
    () => null,
    vi.fn(),
  );
  await expect(compositor.prepare()).rejects.toBeInstanceOf(RecordingContentError);
  expect(sdk.createProcessor).not.toHaveBeenCalled();
  await compositor.dispose();
});
it('closes a frame that finishes rasterizing after the call ends', async () => {
  const sdk = stream();
  const root = document.createElement('div');
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  } as DOMRect);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  let finish!: (bitmap: ImageBitmap) => void;
  vi.stubGlobal(
    'createImageBitmap',
    () =>
      new Promise<ImageBitmap>((resolve) => {
        finish = resolve;
      }),
  );
  const compositor = new MeetingShareCompositor(
    sdk as unknown as Stream,
    () => ({ root, mode: 'annotations' }),
    vi.fn(),
  );
  const preparing = compositor.prepare();
  await Promise.resolve();
  await Promise.resolve();
  await compositor.dispose();
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  finish(bitmap);
  await preparing;
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(
    sdk.processor.port.postMessage.mock.calls.some(([value]) => value.type === 'frame'),
  ).toBe(false);
});

it('keeps the whiteboard mask installed when browser capture cannot be stopped safely', async () => {
  const sdk = stream();
  sdk.stopShareScreen.mockResolvedValue(new Error('Cannot stop'));
  const compositor = new MeetingShareCompositor(
    sdk as unknown as Stream,
    () => null,
    vi.fn(),
  );
  await compositor.prepare();
  compositor.setMode('whiteboard');
  await compositor.dispose();
  expect(sdk.stopShareScreen).toHaveBeenCalledOnce();
  expect(sdk.removeProcessor).not.toHaveBeenCalled();
});
