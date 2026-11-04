import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClassroomRosterVM } from '@iconicedu/shared-types';
import { createClassroomCallsApi } from '@iconicedu/web/lib/api/classroom-calls';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
export function useClassroomRoster(
  sessionId: string,
  joined: boolean,
  profileIds: string[],
) {
  const api = useMemo(() => createClassroomCallsApi(createSupabaseBrowserClient()), []);
  const [roster, setRoster] = useState<ClassroomRosterVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const identities = JSON.stringify(profileIds);
  useEffect(() => {
    if (!joined) return;
    let active = true;
    let loading = false;
    const connectionId = crypto.randomUUID();
    const ids = JSON.parse(identities) as string[];
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        await api.presence(sessionId, connectionId, ids, true);
        if (!active) {
          await api.presence(sessionId, connectionId, ids, false);
          return;
        }
        const value = await api.roster(sessionId);
        if (active) setRoster(value);
      } catch {
        /* Signed-out guests and flag-OFF retain the existing meeting panel. */
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
      void api.presence(sessionId, connectionId, ids, false).catch(() => {});
      setRoster(null);
    };
  }, [api, sessionId, joined, identities]);
  const call = async (profileId: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(profileId);
    setError(null);
    try {
      await api.ring(sessionId, profileId);
      setRoster(await api.roster(sessionId));
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
      await api.respond(id, 'cancelled');
      setRoster(await api.roster(sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to cancel call.');
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return { roster, error, pending, call, cancel };
}
