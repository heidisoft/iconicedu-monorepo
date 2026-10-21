import { useEffect } from 'react';
import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from '@excalidraw/excalidraw/types';
import type {
  WhiteboardLaserPresenceVM,
  WhiteboardLaserSampleVM,
} from '@iconicedu/shared-types';
import { participantColor } from '@iconicedu/utils';
declare global {
  interface Window {
    classroomLasers?: (
      presence: (WhiteboardLaserPresenceVM & { name?: string })[],
    ) => void;
  }
}
/** Excalidraw owns scene-coordinate laser trails, using the same presence contract as web. */
export function useClassroomLasers(api: ExcalidrawImperativeAPI | null) {
  useEffect(() => {
    if (!api) return;
    const peers = new Map<
      string,
      {
        seen: Set<string>;
        queue: WhiteboardLaserSampleVM[];
        expiresAt: number;
        name?: string;
      }
    >();
    const collaborators = new Map<SocketId, Collaborator>();
    window.classroomLasers = (presence) => {
      for (const value of presence) {
        const peer = peers.get(value.actorId) ?? {
          seen: new Set<string>(),
          queue: [],
          expiresAt: value.expiresAt,
        };
        peer.expiresAt = value.expiresAt;
        peer.name = value.name;
        for (const sample of value.samples)
          if (!peer.seen.has(sample.id)) {
            peer.seen.add(sample.id);
            peer.queue.push(sample);
          }
        peer.queue = peer.queue.slice(-64);
        if (peer.seen.size > 128)
          peer.seen = new Set(value.samples.map((sample) => sample.id));
        peers.set(value.actorId, peer);
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
            collaborators.set(socket, { ...previous, button: 'up' });
            peer.queue = [];
            peer.expiresAt = Date.now() + 50;
          } else {
            peers.delete(actor);
            collaborators.delete(socket);
          }
          changed = true;
        } else {
          const sample = peer.queue.shift();
          if (sample) {
            collaborators.set(socket, {
              username: peer.name,
              pointer: {
                x: sample.x,
                y: sample.y,
                tool: 'laser',
                renderCursor: true,
                laserColor: participantColor(actor),
              },
              button: sample.button,
            });
            changed = true;
          }
        }
      }
      if (changed) api.updateScene({ collaborators: new Map(collaborators) });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      delete window.classroomLasers;
      api.updateScene({ collaborators: new Map() });
    };
  }, [api]);
}
