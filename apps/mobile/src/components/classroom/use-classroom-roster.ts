import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import type { ClassroomRosterVM } from '@iconicedu/shared-types';
import { classroomCallsApi } from '@/lib/classroom/calls-api';

export function useClassroomRoster(
  sessionId: string,
  joined: boolean,
  profileIds: string[],
) {
  const [roster, setRoster] = useState<ClassroomRosterVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const identities = JSON.stringify(profileIds);
  useEffect(() => {
    if (!joined) return;
    let active = true;
    let loading = false;
    const connectionId = randomUUID();
    const ids = JSON.parse(identities) as string[];
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        await classroomCallsApi.presence(sessionId, connectionId, ids, true);
        if (!active) {
          await classroomCallsApi.presence(sessionId, connectionId, ids, false);
          return;
        }
        const value = await classroomCallsApi.roster(sessionId);
        if (active) setRoster(value);
      } catch {
        /* Guest meetings and flag-OFF keep the existing in-meeting list. */
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
      void classroomCallsApi
        .presence(sessionId, connectionId, ids, false)
        .catch(() => {});
      setRoster(null);
    };
  }, [sessionId, joined, identities]);
  const call = async (profileId: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(profileId);
    setError(null);
    try {
      await classroomCallsApi.ring(sessionId, profileId);
      setRoster(await classroomCallsApi.roster(sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to call. Try again.');
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  const cancel = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(id);
    setError(null);
    try {
      await classroomCallsApi.respond(id, 'cancelled');
      setRoster(await classroomCallsApi.roster(sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to cancel call.');
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return { roster, error, pending, call, cancel };
}
