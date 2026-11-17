import { useCallback, useEffect, useRef } from 'react';
import type {
  WhiteboardLaserPresenceVM,
  WhiteboardLaserSampleVM,
} from '@iconicedu/shared-types';
import { capabilityGet, capabilityPost } from '@/lib/api/http-client';
import { generateClientMessageId } from '@/lib/messages/client-message-id';
type Repository = {
  lasers?(): Promise<WhiteboardLaserPresenceVM[]>;
  publishLaser?(samples: WhiteboardLaserSampleVM[]): Promise<unknown>;
};
/** The WebView receives only public presence; capability transport stays native. */
export function useNativeWhiteboardLasers(
  token: string,
  repository: Repository | undefined,
  enabled: boolean,
  receive: (presence: WhiteboardLaserPresenceVM[]) => void,
) {
  const outgoing = useRef<WhiteboardLaserSampleVM[]>([]);
  const version = useRef(0);
  const lastMovement = useRef(0);
  const publish = useCallback(
    (sample: Omit<WhiteboardLaserSampleVM, 'id'>) => {
      if (!enabled) return;
      if (Date.now() - lastMovement.current > 1000) outgoing.current = [];
      lastMovement.current = Date.now();
      outgoing.current = [
        ...outgoing.current,
        { ...sample, id: generateClientMessageId() },
      ].slice(-64);
      version.current++;
    },
    [enabled],
  );
  useEffect(() => {
    outgoing.current = [];
    version.current = 0;
    if (!enabled || (repository && (!repository.lasers || !repository.publishLaser)))
      return;
    let active = true,
      reading = false,
      writing = false,
      sent = 0;
    const read = async () => {
      if (reading) return;
      reading = true;
      try {
        const values = repository
          ? await repository.lasers!()
          : await capabilityGet<WhiteboardLaserPresenceVM[]>(
              '/whiteboards/current/laser',
              token,
            );
        if (active) receive(values);
      } catch {
        /* Ephemeral presence retries without interrupting saved drawing. */
      } finally {
        reading = false;
      }
    };
    const write = async () => {
      if (writing || sent === version.current || Date.now() - lastMovement.current > 3000)
        return;
      writing = true;
      const sending = version.current;
      try {
        const samples = [...outgoing.current];
        if (repository) await repository.publishLaser!(samples);
        else await capabilityPost('/whiteboards/current/laser', token, samples);
        if (active) sent = sending;
      } catch {
        /* Retry the latest ephemeral samples on the next tick. */
      } finally {
        writing = false;
      }
    };
    void read();
    const reader = setInterval(() => {
      void read();
    }, 200);
    const writer = setInterval(() => {
      void write();
    }, 100);
    return () => {
      active = false;
      clearInterval(reader);
      clearInterval(writer);
      receive([]);
    };
  }, [enabled, token, repository, receive]);
  return publish;
}
