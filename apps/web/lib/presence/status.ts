import type { LiveStatusVM, PresenceDisplayStatusVM } from '@iconicedu/shared-types';

export type PresenceConnectionStatus = 'online' | 'away' | 'offline';

export const PRESENCE_AWAY_AFTER_MS = 90 * 1000;
export const PRESENCE_OFFLINE_AFTER_MS = 5 * 60 * 1000;

export function mapConnectionStatusToLiveStatus(
  status: PresenceConnectionStatus,
): LiveStatusVM {
  if (status === 'online') {
    return 'online';
  }
  if (status === 'away') {
    return 'away';
  }
  return 'offline';
}

export function mapConnectionStatusToDisplayStatus(
  status: PresenceConnectionStatus,
): PresenceDisplayStatusVM {
  if (status === 'online') {
    return 'online';
  }
  if (status === 'away') {
    return 'away';
  }
  return 'offline';
}

export function deriveConnectionStatusFromActivity(input: {
  now?: number;
  lastActivityAt: number;
  hasActiveWindow: boolean;
}): PresenceConnectionStatus {
  const now = input.now ?? Date.now();
  if (!input.hasActiveWindow) {
    return 'away';
  }
  const idleForMs = Math.max(0, now - input.lastActivityAt);
  if (idleForMs >= PRESENCE_AWAY_AFTER_MS) {
    return 'away';
  }
  return 'online';
}

export function deriveDisplayStatusFromPresenceRow(input: {
  now?: number;
  reportedStatus?: PresenceDisplayStatusVM | null;
  lastSeenAt?: string | null;
}): PresenceDisplayStatusVM {
  const now = input.now ?? Date.now();
  const reported = input.reportedStatus ?? null;
  const lastSeenMs = input.lastSeenAt ? new Date(input.lastSeenAt).getTime() : NaN;

  if (Number.isNaN(lastSeenMs)) {
    return reported ?? 'offline';
  }

  const ageMs = Math.max(0, now - lastSeenMs);
  if (ageMs >= PRESENCE_OFFLINE_AFTER_MS) {
    return 'offline';
  }

  if (reported === 'busy' || reported === 'idle') {
    return reported;
  }

  if (ageMs >= PRESENCE_AWAY_AFTER_MS) {
    return 'away';
  }

  return reported ?? 'online';
}
