import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnnotationContext, AnnotationObject } from '@iconicedu/shared-types';
import { ApiHttpError } from '@iconicedu/web/lib/api/http-client';
import { useScreenAnnotations } from './use-screen-annotations';
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  pointer: vi.fn(),
  apply: vi.fn(),
  send: vi.fn(),
  subscriptions: new Map<string, (event: { payload: unknown }) => void>(),
}));
vi.mock('./annotation-api', () => ({
  annotationApi: () => ({
    context: mocks.context,
    pointer: mocks.pointer,
    apply: mocks.apply,
  }),
}));
vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    realtime: { setAuth: async () => undefined },
    removeChannel: async () => undefined,
    channel: (topic: string) => {
      const channel = {
        on: (
          _type: string,
          filter: { event: string },
          callback: (event: { payload: unknown }) => void,
        ) => {
          mocks.subscriptions.set(`${topic}:${filter.event}`, callback);
          return channel;
        },
        subscribe: (callback: (status: string) => void) => {
          queueMicrotask(() => callback('SUBSCRIBED'));
          return channel;
        },
        track: async () => undefined,
        send: mocks.send,
      };
      return channel;
    },
  }),
}));
const object: AnnotationObject = {
  id: 'object',
  roomId: 'room',
  shareSessionId: 'room',
  creatorId: 'actor',
  creatorName: 'Tutor',
  creatorRole: 'educator',
  type: 'pen',
  points: [{ x: 0.1, y: 0.1 }],
  style: {
    color: '#ff0000',
    width: 3,
    opacity: 1,
    fontSize: 24,
    bold: false,
    italic: false,
  },
  rotation: 0,
  createdAt: 0,
  updatedAt: 0,
  version: 0,
};
const context: AnnotationContext = {
  actor: { userId: 'actor', name: 'Tutor', role: 'educator' },
  actors: [
    { userId: 'actor', name: 'Tutor', role: 'educator' },
    { userId: 'student', name: 'Student', role: 'student' },
  ],
  snapshot: {
    schemaVersion: 1,
    roomId: 'room',
    shareSessionId: 'room',
    revision: 0,
    studentsEnabled: true,
    ended: false,
    objects: [],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscriptions.clear();
  mocks.context.mockResolvedValue(structuredClone(context));
  mocks.send.mockResolvedValue('ok');
  mocks.pointer.mockResolvedValue(undefined);
  mocks.apply.mockResolvedValue({
    eventId: 'end',
    roomId: 'room',
    revision: 100,
    objects: [],
    studentsEnabled: true,
    ended: true,
  });
});
describe('annotation client', () => {
  it('keeps an acknowledged stroke visible while recovering a missed revision', async () => {
    const { result } = renderHook(() => useScreenAnnotations('session', '123'));
    await waitFor(() => expect(result.current.connected).toBe(true));
    // A snapshot refresh can be slower than the operation acknowledgement.
    mocks.context.mockImplementation(() => new Promise(() => {}));
    mocks.apply.mockResolvedValueOnce({
      eventId: 'fast-stroke',
      roomId: 'room',
      revision: 3,
      objects: [{ ...object, version: 1 }],
      studentsEnabled: true,
      ended: false,
    });
    await act(async () => {
      await result.current.execute({
        eventId: 'fast-stroke',
        kind: 'put',
        object,
        baseVersion: 0,
      });
    });
    expect(result.current.objects).toHaveLength(1);
    expect(result.current.objects[0].version).toBe(1);
    expect(mocks.context.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not close the shared session when the presenter view unmounts', async () => {
    const { result, unmount } = renderHook(() => useScreenAnnotations('session', '123'));
    await waitFor(() => expect(result.current.connected).toBe(true));
    unmount();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('quickly retries when a viewer arrives before the presenter creates the room', async () => {
    vi.useFakeTimers();
    try {
      mocks.context.mockRejectedValueOnce(new ApiHttpError(404, 'Not started'));
      const { result, unmount } = renderHook(() =>
        useScreenAnnotations('session', '123'),
      );
      await act(async () => {});
      expect(result.current.context).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(result.current.context?.snapshot.roomId).toBe('room');
      expect(result.current.connected).toBe(true);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
  it('renders locally before acknowledgement, retries with the same event ID and records history', async () => {
    let acknowledge!: (value: unknown) => void;
    mocks.apply
      .mockRejectedValueOnce(new Error('temporary disconnect'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            acknowledge = resolve;
          }),
      );
    const { result } = renderHook(() => useScreenAnnotations('session', '123'));
    await waitFor(() => expect(result.current.connected).toBe(true));
    let operation!: Promise<unknown>;
    act(() => {
      operation = result.current.execute({
        eventId: 'idempotency-key',
        kind: 'put',
        object,
        baseVersion: 0,
      });
    });
    expect(result.current.objects).toHaveLength(1);
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(2));
    expect(mocks.apply.mock.calls[0]).toEqual(mocks.apply.mock.calls[1]);
    await act(async () => {
      acknowledge({
        eventId: 'idempotency-key',
        roomId: 'room',
        revision: 1,
        objects: [{ ...object, version: 1 }],
        studentsEnabled: true,
        ended: false,
      });
      await operation;
    });
    expect(result.current.objects[0].version).toBe(1);
    expect(result.current.historyCount.undo).toBe(1);
    mocks.apply.mockResolvedValueOnce({
      eventId: 'undo',
      roomId: 'room',
      revision: 2,
      objects: [{ ...object, version: 2, deleted: true }],
      studentsEnabled: true,
      ended: false,
    });
    await act(async () => {
      await result.current.changeHistory('undo');
    });
    expect(result.current.objects).toHaveLength(0);
    expect(result.current.historyCount.redo).toBe(1);
    mocks.apply.mockResolvedValueOnce({
      eventId: 'redo',
      roomId: 'room',
      revision: 3,
      objects: [{ ...object, version: 3 }],
      studentsEnabled: true,
      ended: false,
    });
    await act(async () => {
      await result.current.changeHistory('redo');
    });
    expect(result.current.objects[0].version).toBe(3);
  });
  it('renders remote pointers with the sender color and ignores malformed colors', async () => {
    const { result } = renderHook(() => useScreenAnnotations('session', '123'));
    await waitFor(() => expect(result.current.connected).toBe(true));
    const receive = mocks.subscriptions.get(
      'annotation:room:room:user:student:annotation.preview',
    )!;
    const pointer = {
      roomId: 'room',
      userId: 'student',
      clientId: 'client',
      annotationId: 'pointer:student',
      timestamp: Date.now(),
      kind: 'pointer',
      point: { x: 0.2, y: 0.3 },
      tool: 'spotlight',
    };
    act(() =>
      receive({
        payload: { ...pointer, sequence: 1, eventId: 'pointer-one', color: '#16a34a' },
      }),
    );
    expect(result.current.pointers.student.color).toBe('#16a34a');
    expect(result.current.pointers.student.name).toBe('Student');
    act(() =>
      receive({
        payload: { ...pointer, sequence: 2, eventId: 'pointer-two', color: 'invalid' },
      }),
    );
    expect(result.current.pointers.student.color).toBeUndefined();
  });
  it('rejects spoofed identities, handles points arriving before start, and cancels previews after tutor disables drawing', async () => {
    const { result } = renderHook(() => useScreenAnnotations('session', '123'));
    await waitFor(() => expect(result.current.connected).toBe(true));
    const receive = mocks.subscriptions.get(
      'annotation:room:room:user:student:annotation.preview',
    )!;
    const envelope = {
      roomId: 'room',
      userId: 'student',
      clientId: 'client',
      annotationId: 'stroke',
      timestamp: Date.now(),
    };
    act(() =>
      receive({
        payload: { ...envelope, eventId: 'spoof', sequence: 0, kind: 'start', object },
      }),
    );
    expect(result.current.remoteDrafts).toHaveLength(0);
    act(() =>
      receive({
        payload: {
          ...envelope,
          eventId: 'points',
          sequence: 1,
          kind: 'points',
          points: [{ x: 0.3, y: 0.3 }],
        },
      }),
    );
    act(() =>
      receive({
        payload: {
          ...envelope,
          eventId: 'start',
          sequence: 0,
          kind: 'start',
          object: { ...object, id: 'stroke', creatorId: 'student' },
        },
      }),
    );
    expect(result.current.remoteDrafts[0].points).toHaveLength(2);
    act(() =>
      mocks.subscriptions.get('annotation:room:room:annotation.commit')!({
        payload: {
          eventId: 'permissions',
          roomId: 'room',
          revision: 1,
          objects: [],
          studentsEnabled: false,
          ended: false,
        },
      }),
    );
    act(() =>
      receive({
        payload: {
          ...envelope,
          eventId: 'blocked',
          sequence: 2,
          kind: 'points',
          points: [{ x: 0.6, y: 0.6 }],
        },
      }),
    );
    expect(result.current.remoteDrafts[0]?.points.length ?? 0).toBeLessThan(3);
  });
  it('reloads authoritative state when a revision gap is detected', async () => {
    const { result } = renderHook(() => useScreenAnnotations('session', '123'));
    await waitFor(() => expect(result.current.connected).toBe(true));
    mocks.context.mockResolvedValue({
      ...context,
      snapshot: {
        ...context.snapshot,
        revision: 3,
        objects: [{ ...object, version: 3 }],
      },
    });
    act(() =>
      mocks.subscriptions.get('annotation:room:room:annotation.commit')!({
        payload: {
          eventId: 'gap',
          roomId: 'room',
          revision: 3,
          objects: [],
          studentsEnabled: true,
          ended: false,
        },
      }),
    );
    await waitFor(() => expect(result.current.context?.snapshot.revision).toBe(3));
    expect(result.current.objects[0].version).toBe(3);
  });
});

it('connects shared-link guests without Supabase authentication and polls shared marks', async () => {
  vi.useFakeTimers();
  try {
    const { result, unmount } = renderHook(() =>
      useScreenAnnotations('session', '123', 'guest-capability'),
    );
    await act(async () => {});
    expect(result.current.connected).toBe(true);
    expect(mocks.subscriptions.size).toBe(0);
    mocks.context.mockResolvedValue({
      ...context,
      snapshot: { ...context.snapshot, revision: 1, objects: [object] },
      pointers: [
        {
          userId: 'student',
          name: 'Student',
          point: { x: 0.2, y: 0.3 },
          tool: 'spotlight',
          color: '#16a34a',
          expiresAt: Date.now() + 3000,
        },
      ],
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.objects).toHaveLength(1);
    expect(result.current.pointers.student.name).toBe('Student');
    act(() =>
      result.current.broadcast({
        kind: 'pointer',
        point: { x: 0.4, y: 0.5 },
        tool: 'spotlight',
        color: '#2563eb',
        eventId: 'pointer',
        roomId: 'room',
        clientId: 'guest-client',
        userId: 'actor',
        sequence: 1,
        timestamp: Date.now(),
        annotationId: 'pointer:actor',
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(mocks.pointer).toHaveBeenCalledWith('session', '123', {
      point: { x: 0.4, y: 0.5 },
      tool: 'spotlight',
      color: '#2563eb',
    });
    unmount();
  } finally {
    vi.useRealTimers();
  }
});
