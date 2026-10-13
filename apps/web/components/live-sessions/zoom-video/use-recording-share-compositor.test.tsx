import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { useRecordingShareCompositor } from './use-recording-share-compositor';
const mocks = vi.hoisted(() => ({
  prepare: vi.fn(async () => {}),
  dispose: vi.fn(async () => {}),
  mode: vi.fn(),
}));
vi.mock('./meeting-share-compositor', () => ({
  RecordingContentError: class extends Error {},
  MeetingShareCompositor: class {
    prepare = mocks.prepare;
    dispose = mocks.dispose;
    setMode = mocks.mode;
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
it('trusts Zoom sender metadata, ignores malformed commands and removes ended share metadata', async () => {
  const events = new Map<string, (data: unknown) => void>();
  const send = vi.fn(async () => '');
  const off = vi.fn();
  const client = {
    getMediaStream: () => ({}),
    getCommandClient: () => ({ send }),
    on: (name: string, callback: (data: unknown) => void) => events.set(name, callback),
    off,
  } as unknown as ZoomClient;
  const failure = vi.fn();
  const { result, unmount } = renderHook(() =>
    useRecordingShareCompositor(client, false, () => null, failure, 2),
  );
  const message = (senderId: string, text: string) =>
    events.get('command-channel-message')?.({ senderId, text });
  act(() => {
    message('2', 'null');
    message('2', '{bad');
    message('invalid', '{"type":"meeting-composited-share-v1","active":true}');
  });
  expect(result.current.composited.size).toBe(0);
  act(() =>
    message('3', '{"type":"meeting-composited-share-v1","active":true,"userId":2}'),
  );
  expect(result.current.composited.has(3)).toBe(true);
  expect(result.current.composited.has(2)).toBe(false);
  act(() => message('2', '{"type":"meeting-composited-share-v1","active":true}'));
  await result.current.ensurePresenter(2);
  act(() => message('2', '{"type":"meeting-composited-share-v1","active":false}'));
  expect(failure).toHaveBeenCalledOnce();
  act(() => events.get('peer-share-state-change')?.({ userId: 3, action: 'Stop' }));
  expect(result.current.composited.size).toBe(0);
  unmount();
  expect(off).toHaveBeenCalledWith('command-channel-message', expect.any(Function));
  expect(mocks.dispose).toHaveBeenCalledOnce();
});
