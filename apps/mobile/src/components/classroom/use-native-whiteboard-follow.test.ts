import { act, renderHook } from '@testing-library/react-native';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';
import { useNativeWhiteboardFollow } from './use-native-whiteboard-follow';
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
  jest.useFakeTimers();
  const tutor = { centerX: 100, centerY: 200, zoom: 2 };
  const peer = { centerX: -100, centerY: -200, zoom: 1 };
  const repository = {
    load: jest.fn(),
    save: jest.fn(),
    publishViewport: jest.fn().mockResolvedValue({}),
    viewports: jest.fn().mockResolvedValue([
      { actorId: 'tutor', viewport: tutor, expiresAt: Date.now() + 10000 },
      { actorId: 'peer', viewport: peer, expiresAt: Date.now() + 10000 },
    ]),
  };
  const receive = jest.fn();
  const { result, unmount } = renderHook(() =>
    useNativeWhiteboardFollow('token', repository, snapshot, true, receive),
  );
  await act(async () => {});
  expect(result.current.following).toBe('tutor');
  expect(receive).toHaveBeenLastCalledWith(tutor, expect.any(String));
  const firstSource = receive.mock.calls[0][1];
  act(() => result.current.setFollowing('peer'));
  await act(async () => {});
  expect(receive).toHaveBeenLastCalledWith(peer, expect.any(String));
  act(() => result.current.setFollowing('free'));
  await act(async () => {});
  receive.mockClear();
  act(() => result.current.publish(tutor));
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(repository.publishViewport).toHaveBeenCalledWith(tutor);
  expect(receive).not.toHaveBeenCalled();
  act(() => result.current.setFollowing('tutor'));
  await act(async () => {});
  expect(receive.mock.calls[receive.mock.calls.length - 1][1]).not.toBe(firstSource);
  unmount();
  const calls = repository.viewports.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(repository.viewports).toHaveBeenCalledTimes(calls);
  jest.useRealTimers();
});
it('ignores expired viewport samples', async () => {
  const repository = {
    load: jest.fn(),
    save: jest.fn(),
    publishViewport: jest.fn(),
    viewports: jest.fn().mockResolvedValue([
      {
        actorId: 'tutor',
        viewport: { centerX: 0, centerY: 0, zoom: 1 },
        expiresAt: Date.now() - 1,
      },
    ]),
  };
  const receive = jest.fn();
  const { unmount } = renderHook(() =>
    useNativeWhiteboardFollow('token', repository, snapshot, true, receive),
  );
  await act(async () => {});
  expect(receive).not.toHaveBeenCalled();
  unmount();
});

it('focuses only once while continuing to publish local viewports', async () => {
  jest.useFakeTimers();
  const viewport = { centerX: 300, centerY: 400, zoom: 2 };
  const repository = {
    load: jest.fn(),
    save: jest.fn(),
    publishViewport: jest.fn().mockRejectedValue(new Error('publication unavailable')),
    viewports: jest
      .fn()
      .mockResolvedValue([{ actorId: 'tutor', viewport, expiresAt: Date.now() + 10000 }]),
  };
  const receive = jest.fn();
  const { result, unmount } = renderHook(() =>
    useNativeWhiteboardFollow('token', repository, snapshot, true, receive),
  );
  await act(async () => {});
  receive.mockClear();
  act(() => result.current.publish({ centerX: 0, centerY: 0, zoom: 1 }));
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(repository.publishViewport).toHaveBeenCalled();
  expect(receive).not.toHaveBeenCalled();
  act(() => result.current.focusTutor());
  await act(async () => {});
  expect(receive).toHaveBeenCalledWith(viewport, expect.any(String));
  expect(result.current.status).toBe('following');
  unmount();
  jest.useRealTimers();
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
    load: jest.fn(),
    save: jest.fn(),
    publishViewport: jest.fn(),
    viewports: jest
      .fn()
      .mockResolvedValue([
        { actorId: 'new-tutor', viewport, expiresAt: Date.now() + 10000 },
      ]),
  };
  const receive = jest.fn();
  const { unmount } = renderHook(() =>
    useNativeWhiteboardFollow('token', repository, current, true, receive),
  );
  await act(async () => {});
  expect(receive).toHaveBeenCalledWith(viewport, expect.any(String));
  unmount();
});

it('keeps writing presence updated after focusing without following continuously', async () => {
  jest.useFakeTimers();
  const repository = {
    load: jest.fn(),
    save: jest.fn(),
    publishViewport: jest.fn().mockResolvedValue({}),
    viewports: jest.fn().mockResolvedValue([
      {
        actorId: 'tutor',
        viewport: { centerX: 0, centerY: 0, zoom: 1, writing: { x: 10, y: 20 } },
        expiresAt: Date.now() + 10000,
      },
    ]),
  };
  const receive = jest.fn();
  const { result, unmount } = renderHook(() =>
    useNativeWhiteboardFollow('token', repository, snapshot, true, receive),
  );
  await act(async () => {});
  expect(result.current.writers[0].viewport.writing).toEqual({ x: 10, y: 20 });
  repository.viewports.mockResolvedValue([
    {
      actorId: 'tutor',
      viewport: { centerX: 0, centerY: 0, zoom: 1, writing: { x: 30, y: 40 } },
      expiresAt: Date.now() + 10000,
    },
  ]);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(result.current.writers[0].viewport.writing).toEqual({ x: 30, y: 40 });
  expect(receive).toHaveBeenCalledTimes(1);
  unmount();
  jest.useRealTimers();
});

it('focuses the active student once and retains hover cursors between strokes', async () => {
  jest.useFakeTimers();
  const repository = {
    load: jest.fn(),
    save: jest.fn(),
    publishViewport: jest.fn(),
    viewports: jest.fn().mockResolvedValue([
      {
        actorId: 'tutor',
        viewport: { centerX: 0, centerY: 0, zoom: 1 },
        expiresAt: Date.now() + 10000,
      },
      {
        actorId: 'peer',
        viewport: {
          centerX: 0,
          centerY: 0,
          zoom: 1,
          writing: { x: 400, y: 500 },
          pointer: { x: 410, y: 510 },
        },
        expiresAt: Date.now() + 9000,
      },
    ]),
  };
  const receive = jest.fn();
  const { result, unmount } = renderHook(() =>
    useNativeWhiteboardFollow('token', repository, snapshot, true, receive),
  );
  await act(async () => {});
  receive.mockClear();
  act(() => result.current.focusActive());
  await act(async () => {});
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ centerX: 400, centerY: 500 }),
    expect.any(String),
  );
  repository.viewports.mockResolvedValue([
    {
      actorId: 'peer',
      viewport: { centerX: 0, centerY: 0, zoom: 1, pointer: { x: 420, y: 520 } },
      expiresAt: Date.now() + 9000,
    },
  ]);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(receive).toHaveBeenCalledTimes(1);
  expect(result.current.writers).toHaveLength(1);
  unmount();
  jest.useRealTimers();
});
