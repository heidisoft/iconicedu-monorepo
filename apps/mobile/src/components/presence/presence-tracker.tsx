import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { apiPost } from '@/lib/api/http-client';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';

type PresenceConnectionStatus = 'online' | 'away' | 'offline';

const PRESENCE_HEARTBEAT_MS = 60 * 1000;

function mapConnectionStatusToLiveStatus(status: PresenceConnectionStatus) {
  if (status === 'online') return 'in_class';
  if (status === 'away') return 'away';
  return 'offline';
}

function mapConnectionStatusToDisplayStatus(status: PresenceConnectionStatus) {
  if (status === 'online') return 'online';
  if (status === 'away') return 'away';
  return 'offline';
}

export function PresenceTracker() {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const previousState = useRef<AppStateStatus>(AppState.currentState);
  const lastPublishedStatusRef = useRef<PresenceConnectionStatus | null>(null);
  const lastHeartbeatAtRef = useRef(0);

  const orgId = account?.org_id ?? '';
  const profileId =
    ((profile as Record<string, unknown> | undefined)?.id as string | undefined) ?? '';

  useEffect(() => {
    if (!orgId || !profileId) return;

    let disposed = false;

    const publishPresence = async (
      status: PresenceConnectionStatus,
      options?: { force?: boolean },
    ) => {
      if (disposed) return;
      const now = Date.now();
      const isHeartbeatDue = now - lastHeartbeatAtRef.current >= PRESENCE_HEARTBEAT_MS;
      const shouldPublish =
        options?.force ||
        lastPublishedStatusRef.current !== status ||
        (status === 'online' && isHeartbeatDue);

      if (!shouldPublish) return;

      lastPublishedStatusRef.current = status;
      if (status === 'online') {
        lastHeartbeatAtRef.current = now;
      }

      await apiPost('/presence', {
        orgId,
        profileId,
        status: mapConnectionStatusToDisplayStatus(status),
        liveStatus: mapConnectionStatusToLiveStatus(status),
      });
    };

    const publishForAppState = (state: AppStateStatus, force = false) => {
      if (state === 'active') {
        void publishPresence('online', { force });
      } else if (state === 'inactive') {
        void publishPresence('away', { force });
      } else {
        void publishPresence('offline', { force });
      }
    };

    publishForAppState(AppState.currentState, true);

    const heartbeat = setInterval(() => {
      if (AppState.currentState === 'active') {
        void publishPresence('online');
      }
    }, PRESENCE_HEARTBEAT_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      previousState.current = nextState;
      publishForAppState(nextState, true);
    });

    return () => {
      disposed = true;
      clearInterval(heartbeat);
      subscription.remove();
      apiPost('/presence', {
        orgId,
        profileId,
        status: 'offline',
      }).then(
        () => {},
        () => {},
      );
    };
  }, [orgId, profileId]);

  return null;
}
