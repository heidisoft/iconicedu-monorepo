'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  AnnotationCommit,
  AnnotationContext,
  AnnotationObject,
  AnnotationOperation,
  AnnotationPreview,
  AnnotationPoint,
} from '@iconicedu/shared-types';
import { AnnotationStrokeBuffer, applyAnnotationCommit } from '@iconicedu/utils';
import { ApiHttpError } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { annotationApi } from './annotation-api';
type HistoryEntry = { before: AnnotationObject | null; after: AnnotationObject }[];
type RemoteDraft = {
  object: AnnotationObject;
  buffer: AnnotationStrokeBuffer;
  timestamp: number;
  clientId: string;
};
export function useScreenAnnotations(
  sessionId: string,
  shareKey: string,
  annotationToken?: string,
) {
  const api = useMemo(() => annotationApi(annotationToken), [annotationToken]);
  const [context, setContext] = useState<AnnotationContext | null>(null);
  const contextRef = useRef<AnnotationContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [optimistic, setOptimistic] = useState<Record<string, AnnotationObject>>({});
  const [remoteDrafts, setRemoteDrafts] = useState<AnnotationObject[]>([]);
  const [pointers, setPointers] = useState<
    Record<
      string,
      {
        point: AnnotationPoint;
        tool: 'spotlight' | 'pointerArrow';
        name: string;
        expiresAt: number;
      }
    >
  >({});
  const [vanishing, setVanishing] = useState<
    { object: AnnotationObject; expiresAt: number }[]
  >([]);
  const [historyCount, setHistoryCount] = useState({ undo: 0, redo: 0 });
  const ownChannel = useRef<RealtimeChannel | null>(null);
  const history = useRef<HistoryEntry[]>([]);
  const redo = useRef<HistoryEntry[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);
  const clientId = useRef(crypto.randomUUID());
  const publishContext = useCallback((value: AnnotationContext) => {
    contextRef.current = value;
    setContext(value);
  }, []);
  const refresh = useCallback(async () => {
    const currentGeneration = generation.current;
    const value = await api.context(sessionId, shareKey);
    if (currentGeneration !== generation.current) return;
    const current = contextRef.current;
    if (
      !current ||
      value.snapshot.roomId !== current.snapshot.roomId ||
      value.snapshot.revision >= current.snapshot.revision
    )
      publishContext(value);
    setError(null);
    if (annotationToken) setConnected(true);
  }, [annotationToken, api, sessionId, shareKey, publishContext]);
  const receiveCommit = useCallback(
    (commit: AnnotationCommit) => {
      const current = contextRef.current;
      if (!current || commit.roomId !== current.snapshot.roomId) return;
      if (commit.requiresSnapshot || commit.revision > current.snapshot.revision + 1) {
        void refresh().catch(() => setError('Reconnecting annotations…'));
        return;
      }
      publishContext({
        ...current,
        snapshot: applyAnnotationCommit(current.snapshot, commit),
      });
      if (!commit.studentsEnabled || commit.ended) {
        setRemoteDrafts((previous) =>
          commit.ended
            ? []
            : previous.filter((object) => object.creatorRole === 'educator'),
        );
        setVanishing((previous) =>
          commit.ended
            ? []
            : previous.filter((stroke) => stroke.object.creatorRole === 'educator'),
        );
        setPointers((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(
              ([id]) =>
                !commit.ended &&
                current.actors.find((actor) => actor.userId === id)?.role === 'educator',
            ),
          ),
        );
      }
    },
    [publishContext, refresh],
  );
  useEffect(() => {
    let alive = true;
    const effectGeneration = ++generation.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        await refresh();
      } catch (error: unknown) {
        if (alive) {
          setConnected(false);
          if (!(error instanceof ApiHttpError && error.status === 404))
            setError(
              error instanceof Error ? error.message : 'Unable to connect annotations',
            );
        }
      } finally {
        // A viewer can arrive before the presenter creates the annotation room.
        if (alive)
          timer = setTimeout(
            () => void poll(),
            annotationToken ? 500 : contextRef.current ? 10000 : 1000,
          );
      }
    };
    void poll();
    return () => {
      alive = false;
      generation.current = effectGeneration + 1;
      contextRef.current = null;
      clearTimeout(timer);
    };
  }, [annotationToken, api, refresh]);
  const roomId = context?.snapshot.roomId;
  const canDraw = Boolean(
    context &&
    !context.snapshot.ended &&
    (context.actor.role === 'educator' || context.snapshot.studentsEnabled),
  );
  const actorsKey =
    context?.actors
      .map((actor) => actor.userId)
      .sort()
      .join(',') ?? '';
  useEffect(() => {
    if (annotationToken || !roomId || !contextRef.current) return;
    const supabase = createSupabaseBrowserClient();
    const channels: RealtimeChannel[] = [];
    const drafts = new Map<string, RemoteDraft>();
    const seen = new Set<string>();
    const terminal = new Map<string, number>();
    const orphanPackets = new Map<
      string,
      Extract<AnnotationPreview, { kind: 'points' }>[]
    >();
    const pointerSequences = new Map<string, number>();
    let alive = true;
    const updateDrafts = () =>
      setRemoteDrafts(
        [...drafts.values()]
          .map((draft) => draft.object)
          .filter(
            (object) =>
              contextRef.current?.snapshot.studentsEnabled ||
              object.creatorRole === 'educator',
          ),
      );
    const validPoint = (p: AnnotationPoint) =>
      p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      p.x >= 0 &&
      p.x <= 1 &&
      p.y >= 0 &&
      p.y <= 1;
    const receivePreview = (senderId: string, event: AnnotationPreview) => {
      const current = contextRef.current;
      const actor = current?.actors.find((actor) => actor.userId === senderId);
      if (
        !alive ||
        !current ||
        !actor ||
        current.snapshot.ended ||
        (actor.role === 'student' && !current.snapshot.studentsEnabled)
      )
        return;
      if (
        !event ||
        event.roomId !== roomId ||
        event.userId !== senderId ||
        typeof event.eventId !== 'string' ||
        seen.has(event.eventId) ||
        !Number.isFinite(event.timestamp) ||
        Math.abs(Date.now() - event.timestamp) > 15000
      )
        return;
      if (seen.size >= 4096) seen.clear();
      seen.add(event.eventId);
      const key = `${senderId}:${event.clientId}:${event.annotationId}`;
      if (terminal.has(key)) return;
      if (event.kind === 'start') {
        const object = event.object;
        if (
          !object ||
          object.creatorId !== senderId ||
          !Array.isArray(object.points) ||
          object.points.length > 128 ||
          !object.points.every(validPoint) ||
          !object.style ||
          !/^#[a-f0-9]{6}$/i.test(object.style.color) ||
          !Number.isFinite(object.style.width) ||
          object.style.width < 0.1 ||
          object.style.width > 40
        )
          return;
        // Preview tools are deliberately restricted to paths; no untrusted HTML/text.
        if (
          ![
            'pen',
            'highlighter',
            'vanishingPen',
            'line',
            'arrow',
            'doubleArrow',
            'rectangle',
            'rectangleFilled',
            'rectangleHighlight',
            'ellipse',
            'ellipseFilled',
            'ellipseHighlight',
            'diamond',
          ].includes(object.type) ||
          drafts.size >= 64
        )
          return;
        drafts.set(key, {
          object: { ...object, creatorName: actor.name, creatorRole: actor.role },
          buffer: new AnnotationStrokeBuffer(object.points),
          timestamp: Date.now(),
          clientId: event.clientId,
        });
        for (const packet of orphanPackets.get(key) ?? [])
          receivePreview(senderId, { ...packet, eventId: `${packet.eventId}:replay` });
        orphanPackets.delete(key);
        updateDrafts();
      } else if (event.kind === 'points') {
        const draft = drafts.get(key);
        if (
          (draft && draft.clientId !== event.clientId) ||
          !Array.isArray(event.points) ||
          event.points.length > 128 ||
          !event.points.every(validPoint)
        )
          return;
        if (!draft) {
          if (orphanPackets.size < 64) {
            const packets = orphanPackets.get(key) ?? [];
            if (packets.length < 32) orphanPackets.set(key, [...packets, event]);
          }
          return;
        }
        const points = draft.buffer.append(event.sequence, event.points);
        draft.object = {
          ...draft.object,
          points: ['pen', 'highlighter', 'vanishingPen'].includes(draft.object.type)
            ? points
            : [points[0], points[points.length - 1]],
        };
        draft.timestamp = Date.now();
        updateDrafts();
      } else if (event.kind === 'finish') {
        terminal.set(key, Date.now());
        orphanPackets.delete(key);
        drafts.delete(key);
        updateDrafts();
      } else if (
        event.kind === 'pointer' &&
        validPoint(event.point) &&
        ['spotlight', 'pointerArrow'].includes(event.tool)
      ) {
        const pointerKey = `${senderId}:${event.clientId}`;
        if (event.sequence <= (pointerSequences.get(pointerKey) ?? -1)) return;
        pointerSequences.set(pointerKey, event.sequence);
        setPointers((previous) => ({
          ...previous,
          [senderId]: {
            point: event.point,
            tool: event.tool,
            name: actor.name,
            expiresAt: Date.now() + (event.tool === 'spotlight' ? 1500 : 5000),
          },
        }));
      } else if (event.kind === 'vanish') {
        const draft = drafts.get(key);
        if (!draft || !Number.isFinite(event.expiresAt)) return;
        setVanishing((previous) => [
          ...previous.slice(-63),
          {
            object: draft.object,
            expiresAt: Math.min(Date.now() + 5000, event.expiresAt),
          },
        ]);
        drafts.delete(key);
        updateDrafts();
      }
    };
    void supabase.realtime
      .setAuth()
      .then(() => {
        if (!alive) return;
        const state = supabase
          .channel(`annotation:room:${roomId}`, { config: { private: true } })
          .on('broadcast', { event: 'annotation.commit' }, ({ payload }) => {
            // This topic is receive-only for clients; all commits are produced by the SQL transaction.
            receiveCommit(payload as AnnotationCommit);
          })
          .subscribe((status) => {
            if (!alive) return;
            setConnected(status === 'SUBSCRIBED');
            if (status === 'SUBSCRIBED')
              void refresh().catch(() => setError('Unable to restore annotations'));
          });
        channels.push(state);
        for (const actor of contextRef.current?.actors ?? []) {
          const own = actor.userId === contextRef.current?.actor.userId;
          const channel = supabase
            .channel(`annotation:room:${roomId}:user:${actor.userId}`, {
              config: {
                private: true,
                broadcast: { self: false },
                presence: { key: actor.userId },
              },
            })
            .on('broadcast', { event: 'annotation.preview' }, ({ payload }) =>
              receivePreview(actor.userId, payload as AnnotationPreview),
            )
            .subscribe((status) => {
              if (alive && own && canDraw && status === 'SUBSCRIBED')
                void channel.track({
                  name: actor.name,
                  role: actor.role,
                  canAnnotate: canDraw,
                });
            });
          if (own && canDraw) ownChannel.current = channel;
          channels.push(channel);
        }
      })
      .catch(() => {
        if (alive) setError('Unable to authorize annotation channels');
      });
    const expiry = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of terminal)
        if (now - timestamp > 15000) terminal.delete(key);
      for (const [key, packets] of orphanPackets)
        if (now - packets[0].timestamp > 3000) orphanPackets.delete(key);
      let changed = false;
      for (const [key, draft] of drafts)
        if (now - draft.timestamp > 3000) {
          drafts.delete(key);
          changed = true;
        }
      if (changed) updateDrafts();
      setPointers((previous) =>
        Object.values(previous).some((pointer) => pointer.expiresAt < now)
          ? Object.fromEntries(
              Object.entries(previous).filter(([, pointer]) => pointer.expiresAt >= now),
            )
          : previous,
      );
      setVanishing((previous) =>
        previous.length
          ? previous
              .filter((stroke) => stroke.expiresAt >= now)
              .map((stroke) => ({ ...stroke }))
          : previous,
      );
    }, 100);
    return () => {
      alive = false;
      setConnected(false);
      clearInterval(expiry);
      ownChannel.current = null;
      setRemoteDrafts([]);
      setPointers({});
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [annotationToken, roomId, actorsKey, canDraw, receiveCommit, refresh]);
  const broadcast = useCallback((event: AnnotationPreview) => {
    if (event.kind === 'vanish')
      setVanishing((previous) => [
        ...previous.slice(-63),
        { object: event.object, expiresAt: event.expiresAt },
      ]);
    if (event.kind === 'pointer')
      setPointers((previous) => ({
        ...previous,
        [event.userId]: {
          point: event.point,
          tool: event.tool,
          name: contextRef.current?.actor.name ?? '',
          expiresAt: Date.now() + (event.tool === 'spotlight' ? 1500 : 5000),
        },
      }));
    const channel = ownChannel.current;
    if (channel)
      void channel
        .send({ type: 'broadcast', event: 'annotation.preview', payload: event })
        .then((status) => {
          if (status !== 'ok') setError('Drawing preview connection interrupted');
        });
  }, []);
  const execute = useCallback(
    (operation: AnnotationOperation, remember = true): Promise<AnnotationCommit> => {
      const current = contextRef.current;
      if (!current) return Promise.reject(new Error('Annotations are not ready'));
      const currentGeneration = generation.current;
      if (operation.kind === 'put')
        setOptimistic((previous) => ({
          ...previous,
          [operation.object.id]: operation.object,
        }));
      const run = async () => {
        if (currentGeneration !== generation.current)
          throw new Error('Screen share changed');
        const before = contextRef.current?.snapshot.objects ?? [];
        try {
          let commit: AnnotationCommit | undefined;
          for (let attempt = 0; attempt < 8; attempt++) {
            if (currentGeneration !== generation.current)
              throw new Error('Screen share changed');
            try {
              commit = await api.apply(current.snapshot.roomId, operation);
              break;
            } catch (error) {
              if (
                (error instanceof ApiHttpError &&
                  error.status >= 400 &&
                  error.status < 500) ||
                attempt === 7
              )
                throw error;
              setError('Waiting to reconnect and save annotations…');
              // Reuse the event ID after a lost response; receipts prevent duplicate commits.
              if (attempt > 0)
                await new Promise((resolve) =>
                  setTimeout(resolve, Math.min(3000, 500 * 2 ** (attempt - 1))),
                );
            }
          }
          if (!commit) throw new Error('Unable to save annotation');
          if (currentGeneration !== generation.current) return commit;
          receiveCommit(commit);
          setError(null);
          if (
            remember &&
            ['put', 'delete', 'clear'].includes(operation.kind) &&
            commit.objects.length
          ) {
            history.current.push(
              commit.objects.map((after) => ({
                before:
                  before.find((object) => object.id === after.id && !object.deleted) ??
                  null,
                after,
              })),
            );
            history.current = history.current.slice(-100);
            redo.current = [];
            setHistoryCount({ undo: history.current.length, redo: 0 });
          }
          return commit;
        } catch (error) {
          if (currentGeneration === generation.current) {
            setError(
              error instanceof Error ? error.message : 'Unable to save annotation',
            );
            await refresh().catch(() => undefined);
          }
          throw error;
        } finally {
          if (currentGeneration === generation.current && operation.kind === 'put')
            setOptimistic((previous) => {
              const next = { ...previous };
              delete next[operation.object.id];
              return next;
            });
        }
      };
      const result = queue.current.then(run, run);
      queue.current = result.catch(() => undefined);
      return result;
    },
    [api, receiveCommit, refresh],
  );
  const changeHistory = useCallback(
    async (direction: 'undo' | 'redo') => {
      const from = direction === 'undo' ? history.current : redo.current;
      const entry = from[from.length - 1];
      if (!entry) return;
      const results: HistoryEntry = [];
      for (const step of entry) {
        const current = contextRef.current?.snapshot.objects.find(
          (object) => object.id === step.after.id,
        );
        if (!current || current.version !== step.after.version) {
          setError('This annotation changed; its earlier edit cannot be restored.');
          return;
        }
        const target = step.before;
        const result = await execute(
          target
            ? {
                eventId: crypto.randomUUID(),
                kind: 'put',
                object: target,
                baseVersion: current.version,
              }
            : {
                eventId: crypto.randomUUID(),
                kind: 'delete',
                id: current.id,
                baseVersion: current.version,
              },
          false,
        );
        results.push({
          before: step.after.deleted ? null : step.after,
          after: result.objects[0],
        });
      }
      from.pop();
      (direction === 'undo' ? redo.current : history.current).push(results);
      setHistoryCount({ undo: history.current.length, redo: redo.current.length });
    },
    [execute],
  );
  const objects = useMemo(() => {
    const map = new Map(
      context?.snapshot.objects.map((object) => [object.id, object]) ?? [],
    );
    for (const object of Object.values(optimistic)) map.set(object.id, object);
    return [...map.values()].filter((object) => !object.deleted);
  }, [context, optimistic]);
  return {
    context,
    objects,
    remoteDrafts,
    pointers,
    vanishing,
    connected,
    canDraw,
    error,
    historyCount,
    broadcast,
    execute,
    changeHistory,
    clientId: clientId.current,
  };
}
