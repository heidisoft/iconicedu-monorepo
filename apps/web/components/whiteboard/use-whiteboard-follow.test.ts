import { act, renderHook } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';
import { useWhiteboardFollow } from './use-whiteboard-follow';
const snapshot: WhiteboardSnapshotVM = {
  id: 'board',
  revision: 1,
  actorId: 'self',
  role: 'student',
  presence: [
    { id: 'tutor', name: 'Tutor', role: 'teacher' },
    { id: 'peer', name: 'Peer', role: 'student' },
  ],
  document: { schemaVersion: 1, studentEditing: false, pages: [] },
};
it('defaults to the tutor, switches participants, and stops following in free mode', async () => {
  vi.useFakeTimers();
  const tutor = { centerX: 100, centerY: 200, zoom: 2 };
  const peer = { centerX: -100, centerY: -200, zoom: 1 };
  const repository = {
    load: vi.fn(),
    save: vi.fn(),
    publishViewport: vi.fn().mockResolvedValue({}),
    viewports: vi.fn().mockResolvedValue([
      { actorId: 'tutor', viewport: tutor, expiresAt: Date.now() + 10000 },
      { actorId: 'peer', viewport: peer, expiresAt: Date.now() + 10000 },
    ]),
  };
  const receive = vi.fn();
  const { result, unmount } = renderHook(() =>
    useWhiteboardFollow('token', repository, snapshot, true, receive),
  );
  await act(async () => {});
  expect(result.current.following).toBe('tutor');
  expect(receive).toHaveBeenLastCalledWith(tutor);
  act(() => result.current.setFollowing('peer'));
  await act(async () => {});
  expect(receive).toHaveBeenLastCalledWith(peer);
  act(() => result.current.setFollowing('free'));
  await act(async () => {});
  receive.mockClear();
  act(() => result.current.publish(tutor));
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
  expect(repository.publishViewport).toHaveBeenCalledWith(tutor);
  expect(receive).not.toHaveBeenCalled();
  unmount();
  const calls = repository.viewports.mock.calls.length;
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
  expect(repository.viewports).toHaveBeenCalledTimes(calls);
  vi.useRealTimers();
});
it('ignores expired viewport samples', async () => {
  const repository = {
    load: vi.fn(),
    save: vi.fn(),
    publishViewport: vi.fn(),
    viewports: vi.fn().mockResolvedValue([
      {
        actorId: 'tutor',
        viewport: { centerX: 0, centerY: 0, zoom: 1 },
        expiresAt: Date.now() - 1,
      },
    ]),
  };
  const receive = vi.fn();
  const { unmount } = renderHook(() =>
    useWhiteboardFollow('token', repository, snapshot, true, receive),
  );
  await act(async () => {});
  expect(receive).not.toHaveBeenCalled();
  unmount();
});

it('continues following when publishing the local viewport fails', async () => {
  vi.useFakeTimers();
  const viewport = { centerX: 300, centerY: 400, zoom: 2 };
  const repository = {
    load: vi.fn(),
    save: vi.fn(),
    publishViewport: vi.fn().mockRejectedValue(new Error('publication unavailable')),
    viewports: vi
      .fn()
      .mockResolvedValue([{ actorId: 'tutor', viewport, expiresAt: Date.now() + 10000 }]),
  };
  const receive = vi.fn();
  const { result, unmount } = renderHook(() =>
    useWhiteboardFollow('token', repository, snapshot, true, receive),
  );
  await act(async () => {});
  receive.mockClear();
  act(() => result.current.publish({ centerX: 0, centerY: 0, zoom: 1 }));
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
  expect(repository.publishViewport).toHaveBeenCalled();
  expect(receive).toHaveBeenCalledWith(viewport);
  expect(result.current.status).toBe('following');
  unmount();
  vi.useRealTimers();
});
it('follows the currently publishing tutor after a capability changes on rejoin', async () => {
  const current = {
    ...snapshot,
    presence: [
      ...snapshot.presence,
      { id: 'new-tutor', name: 'Tutor', role: 'teacher' as const },
    ],
  };
  const viewport = { centerX: 50, centerY: 60, zoom: 1 };
  const repository = {
    load: vi.fn(),
    save: vi.fn(),
    publishViewport: vi.fn(),
    viewports: vi
      .fn()
      .mockResolvedValue([
        { actorId: 'new-tutor', viewport, expiresAt: Date.now() + 10000 },
      ]),
  };
  const receive = vi.fn();
  const { unmount } = renderHook(() =>
    useWhiteboardFollow('token', repository, current, true, receive),
  );
  await act(async () => {});
  expect(receive).toHaveBeenCalledWith(viewport);
  unmount();
});
