import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnnotationContext, AnnotationObject } from '@iconicedu/shared-types';
import { useScreenAnnotations } from './use-screen-annotations';
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  apply: vi.fn(),
  send: vi.fn(),
  subscriptions: new Map<string, (event: { payload: unknown }) => void>(),
}));
vi.mock('./annotation-api', () => ({
  annotationApi: () => ({ context: mocks.context, apply: mocks.apply }),
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
