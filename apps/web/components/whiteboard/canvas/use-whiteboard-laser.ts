'use client';
import { useCallback, useEffect, useRef } from 'react';
import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from '@excalidraw/excalidraw/types';
import { participantColor } from '@iconicedu/utils';
import type { WhiteboardLaserSampleVM } from '@iconicedu/shared-types';
import { createWhiteboardRepository } from '@iconicedu/web/lib/whiteboard/api';

/** Transport native scene-coordinate laser events; Excalidraw owns trail rendering. */
export function useWhiteboardLaser(api: ExcalidrawImperativeAPI | null, token?: string) {
  const outgoing = useRef<WhiteboardLaserSampleVM[]>([]);
  const version = useRef(0);
  const lastMovement = useRef(0);
  useEffect(() => {
    outgoing.current = [];
    version.current = 0;
    if (!api || !token) return;
    const repository = createWhiteboardRepository(token);
    const peers = new Map<
      string,
      { seen: Set<string>; queue: WhiteboardLaserSampleVM[]; expiresAt: number }
    >();
    const collaborators = new Map<SocketId, Collaborator>();
    let disposed = false;
    let reading = false;
    let writing = false;
    let sent = 0;
    const tick = async () => {
      if (Date.now() - lastMovement.current > 3000) return;
      if (!writing && sent !== version.current) {
        writing = true;
        const sending = version.current;
        try {
          await repository.publishLaser!(outgoing.current.slice());
          if (!disposed) sent = sending;
        } catch {
          /* Ephemeral events retry on the next tick. */
        } finally {
          writing = false;
        }
      }
    };
    const read = async () => {
      if (reading) return;
      reading = true;
      try {
        const remote = await repository.lasers!();
        if (disposed) return;
        for (const presence of remote) {
          let peer = peers.get(presence.actorId);
          if (!peer) {
            peer = { seen: new Set(), queue: [], expiresAt: presence.expiresAt };
            peers.set(presence.actorId, peer);
          }
          peer.expiresAt = presence.expiresAt;
          for (const sample of presence.samples) {
            if (!peer.seen.has(sample.id)) {
              peer.seen.add(sample.id);
              peer.queue.push(sample);
            }
          }
          peer.queue = peer.queue.slice(-64);
          // Only the last 64 samples can be returned by the server.
          if (peer.seen.size > 128)
            peer.seen = new Set(presence.samples.map((sample) => sample.id));
        }
      } catch {
        /* A failed presence read must not interrupt drawing. */
      } finally {
        reading = false;
      }
    };
    let frame = 0;
    const render = () => {
      let changed = false;
      for (const [actor, peer] of peers) {
        const socket = actor as SocketId;
        if (peer.expiresAt <= Date.now()) {
          const previous = collaborators.get(socket);
          if (previous?.button === 'down') {
            // Native trails need a release event even if the sender disconnects.
            collaborators.set(socket, { ...previous, button: 'up' });
            peer.queue = [];
            peer.expiresAt = Date.now() + 50;
          } else {
            peers.delete(actor);
            collaborators.delete(socket);
          }
          changed = true;
          continue;
        }
        const sample = peer.queue.shift();
        if (sample) {
          collaborators.set(socket, {
            pointer: {
              x: sample.x,
              y: sample.y,
              tool: 'laser',
              renderCursor: false,
              laserColor: participantColor(actor),
            },
            button: sample.button,
          });
          changed = true;
        }
      }
      if (changed) api.updateScene({ collaborators: new Map(collaborators) });
      frame = requestAnimationFrame(render);
    };
    const publishTimer = setInterval(() => void tick(), 100);
    const readTimer = setInterval(() => void read(), 200);
    void read();
    frame = requestAnimationFrame(render);
    return () => {
      disposed = true;
      clearInterval(publishTimer);
      clearInterval(readTimer);
      cancelAnimationFrame(frame);
      api.updateScene({ collaborators: new Map() });
    };
  }, [api, token]);
  return useCallback(
    (event: {
      pointer: { x: number; y: number; tool: 'pointer' | 'laser' };
      button: 'down' | 'up';
    }) => {
      if (event.pointer.tool !== 'laser') return;
      const previous = outgoing.current[outgoing.current.length - 1];
      if (event.button === 'up' && (!previous || previous.button === 'up')) return;
      if (Date.now() - lastMovement.current > 1000) outgoing.current = [];
      lastMovement.current = Date.now();
      outgoing.current.push({
        id: crypto.randomUUID(),
        x: event.pointer.x,
        y: event.pointer.y,
        button: event.button,
      });
      outgoing.current = outgoing.current.slice(-64);
      version.current++;
    },
    [],
  );
}
