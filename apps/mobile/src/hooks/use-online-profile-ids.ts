import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { apiGet } from '@/lib/api/http-client';
import { supabase } from '@/lib/supabase/client';

const PRESENCE_AWAY_AFTER_MS = 10 * 60 * 1000;
const PRESENCE_OFFLINE_AFTER_MS = 30 * 60 * 1000;
export type PresenceDisplayStatus = 'online' | 'busy' | 'idle' | 'away' | 'offline';

type PresenceRow = {
  profile_id: string;
  live_status?: string | null;
  display_status?: string | null;
  last_seen_at?: string | null;
  deleted_at?: string | null;
};

export type PresenceSummary = {
  status: PresenceDisplayStatus | null;
  lastSeenAt: string | null;
};

type PresenceMeta = {
  profile_id?: string;
};

type PresenceStateValue = PresenceMeta[] | { metas?: PresenceMeta[] } | null | undefined;

type PresenceListener = (onlineIds: Set<string>) => void;

type OrgPresenceSubscription = {
  channel: RealtimeChannel;
  listeners: Set<PresenceListener>;
  onlineIds: Set<string>;
};

const orgPresenceSubscriptions = new Map<string, OrgPresenceSubscription>();

function extractOnlineProfileIdsFromPresenceState(
  presenceState: Record<string, PresenceStateValue> | null | undefined,
): Set<string> {
  const profileIds = new Set<string>();
  if (!presenceState) return profileIds;

  Object.entries(presenceState).forEach(([key, value]) => {
    const metas = Array.isArray(value)
      ? value
      : Array.isArray(value?.metas)
        ? value.metas
        : [];

    if (!metas.length) {
      if (key) profileIds.add(key);
      return;
    }

    metas.forEach((meta) => {
      const profileId = meta?.profile_id?.trim();
      if (profileId) profileIds.add(profileId);
      else if (key) profileIds.add(key);
    });
  });

  return profileIds;
}

function subscribeToOrgRealtimePresence(orgId: string, listener: PresenceListener) {
  let subscription = orgPresenceSubscriptions.get(orgId);

  if (!subscription) {
    const channel = supabase.channel(`sidebar-presence:${orgId}`);
    subscription = {
      channel,
      listeners: new Set(),
      onlineIds: new Set(),
    };

    const syncOnlineIds = () => {
      subscription!.onlineIds = extractOnlineProfileIdsFromPresenceState(
        channel.presenceState?.() ?? {},
      );
      subscription!.listeners.forEach((currentListener) =>
        currentListener(new Set(subscription!.onlineIds)),
      );
    };

    channel.on('presence', { event: 'sync' }, syncOnlineIds);
    channel.on('presence', { event: 'join' }, syncOnlineIds);
    channel.on('presence', { event: 'leave' }, syncOnlineIds);
    channel.subscribe();

    orgPresenceSubscriptions.set(orgId, subscription);
  }

  subscription.listeners.add(listener);
  listener(new Set(subscription.onlineIds));

  return () => {
    const current = orgPresenceSubscriptions.get(orgId);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      supabase.removeChannel(current.channel);
      orgPresenceSubscriptions.delete(orgId);
    }
  };
}

function deriveDisplayStatusFromPresenceRow(input: {
  now?: number;
  reportedStatus?: string | null;
  lastSeenAt?: string | null;
}): PresenceDisplayStatus {
  const now = input.now ?? Date.now();
  const reported = input.reportedStatus ?? null;
  const lastSeenMs = input.lastSeenAt ? new Date(input.lastSeenAt).getTime() : NaN;

  if (Number.isNaN(lastSeenMs)) return 'offline';

  const ageMs = Math.max(0, now - lastSeenMs);
  if (ageMs >= PRESENCE_OFFLINE_AFTER_MS) return 'offline';
  if (reported === 'busy' || reported === 'idle') return reported;
  if (ageMs >= PRESENCE_AWAY_AFTER_MS) return 'away';
  return reported === 'offline' ? 'offline' : 'online';
}

function getPresenceDisplayStatus(
  row: PresenceRow | null | undefined,
): PresenceDisplayStatus | null {
  if (!row?.profile_id || row.deleted_at) return null;
  return deriveDisplayStatusFromPresenceRow({
    reportedStatus: row.display_status ?? null,
    lastSeenAt: row.last_seen_at ?? null,
  });
}

export function useOnlineProfileIds(
  orgId: string,
  _myProfileId: string,
  profileIds: string[],
) {
  const profileIdsKey = useMemo(() => profileIds.filter(Boolean).join('|'), [profileIds]);
  const stableProfileIds = useMemo(() => {
    const uniqueIds = [...new Set(profileIdsKey.split('|').filter(Boolean))].sort();
    return uniqueIds;
  }, [profileIdsKey]);
  const stableProfileIdsKey = useMemo(
    () => stableProfileIds.join(','),
    [stableProfileIds],
  );
  const stableProfileIdSet = useMemo(() => new Set(stableProfileIds), [stableProfileIds]);
  const [presenceByProfileId, setPresenceByProfileId] = useState<
    Map<string, PresenceDisplayStatus>
  >(new Map());
  const dbStatusesRef = useRef<Map<string, PresenceDisplayStatus>>(new Map());
  const realtimeIdsRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    dbStatusesRef.current = new Map();
    realtimeIdsRef.current = new Set();
    setPresenceByProfileId(new Map());

    if (!orgId || stableProfileIds.length === 0) {
      return;
    }

    let cancelled = false;

    const syncState = () => {
      if (cancelled) return;
      const merged = new Map(dbStatusesRef.current);
      realtimeIdsRef.current.forEach((profileId) => {
        if (!stableProfileIdSet.has(profileId)) return;
        const current = merged.get(profileId);
        merged.set(profileId, current === 'busy' ? 'busy' : 'online');
      });
      setPresenceByProfileId((current) => {
        if (current.size === merged.size) {
          let changed = false;
          merged.forEach((value, key) => {
            if (current.get(key) !== value) {
              changed = true;
            }
          });
          if (!changed) {
            return current;
          }
        }
        return merged;
      });
    };

    void apiGet<PresenceRow[]>('/presence', {
      orgId,
      profileIds: stableProfileIds.join(','),
    }).then((data) => {
      if (cancelled) return;
      dbStatusesRef.current = new Map(
        (data ?? [])
          .map(
            (row) =>
              [
                row.profile_id as string,
                getPresenceDisplayStatus(row as PresenceRow),
              ] as const,
          )
          .filter(
            (entry): entry is readonly [string, PresenceDisplayStatus] => !!entry[1],
          ),
      );
      syncState();
    });

    const unsubscribeRealtimePresence = subscribeToOrgRealtimePresence(
      orgId,
      (onlineIds) => {
        realtimeIdsRef.current = onlineIds;
        syncState();
      },
    );

    const channel = supabase.channel(
      `profile-presence-watch:${orgId}:${stableProfileIdsKey}`,
    );
    channelRef.current = channel;
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_presence',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        const row =
          payload.eventType === 'DELETE'
            ? ((payload.old as PresenceRow | null) ?? null)
            : ((payload.new as PresenceRow | null) ?? null);
        const profileId = row?.profile_id;
        if (!profileId || !stableProfileIdSet.has(profileId)) return;

        const nextDbStatuses = new Map(dbStatusesRef.current);
        const nextStatus =
          payload.eventType === 'DELETE' ? null : getPresenceDisplayStatus(row);
        if (!nextStatus) {
          nextDbStatuses.delete(profileId);
        } else {
          nextDbStatuses.set(profileId, nextStatus);
        }
        dbStatusesRef.current = nextDbStatuses;
        syncState();
      },
    );

    channel.subscribe();

    return () => {
      cancelled = true;
      unsubscribeRealtimePresence();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orgId, stableProfileIds, stableProfileIdsKey, stableProfileIdSet]);

  return presenceByProfileId;
}

export function useProfilePresenceSummary(orgId: string, profileId: string) {
  const [summary, setSummary] = useState<PresenceSummary>({
    status: null,
    lastSeenAt: null,
  });

  useEffect(() => {
    if (!orgId || !profileId) {
      setSummary({ status: null, lastSeenAt: null });
      return;
    }

    let cancelled = false;
    let dbRow: PresenceRow | null = null;
    let realtimeOnline = false;

    const syncSummary = () => {
      if (cancelled) return;
      const dbStatus = getPresenceDisplayStatus(dbRow);
      setSummary({
        status: realtimeOnline ? (dbStatus === 'busy' ? 'busy' : 'online') : dbStatus,
        lastSeenAt: dbRow?.last_seen_at ?? null,
      });
    };

    void supabase
      .from('profile_presence')
      .select('profile_id, live_status, display_status, last_seen_at, deleted_at')
      .eq('org_id', orgId)
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        dbRow = (data as PresenceRow | null) ?? null;
        syncSummary();
      });

    const unsubscribeRealtimePresence = subscribeToOrgRealtimePresence(
      orgId,
      (onlineIds) => {
        realtimeOnline = onlineIds.has(profileId);
        syncSummary();
      },
    );

    const channel = supabase.channel(`profile-presence-summary:${orgId}:${profileId}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_presence',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        const row =
          payload.eventType === 'DELETE'
            ? ((payload.old as PresenceRow | null) ?? null)
            : ((payload.new as PresenceRow | null) ?? null);
        if (row?.profile_id !== profileId) return;
        dbRow = payload.eventType === 'DELETE' ? null : row;
        syncSummary();
      },
    );

    channel.subscribe();

    return () => {
      cancelled = true;
      unsubscribeRealtimePresence();
      supabase.removeChannel(channel);
    };
  }, [orgId, profileId]);

  return summary;
}
