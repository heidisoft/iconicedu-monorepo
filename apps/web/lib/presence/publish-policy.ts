import type { PresenceConnectionStatus } from '@iconicedu/web/lib/presence/status';

export function shouldPublishPresence(input: {
  nextStatus: PresenceConnectionStatus;
  lastPublishedStatus: PresenceConnectionStatus | null;
  now?: number;
  force?: boolean;
  heartbeatMs: number;
  lastOnlineHeartbeatAt: number;
}): boolean {
  if (input.force) {
    return true;
  }

  if (input.lastPublishedStatus !== input.nextStatus) {
    return true;
  }

  if (input.nextStatus !== 'online') {
    return false;
  }

  const now = input.now ?? Date.now();
  return now - input.lastOnlineHeartbeatAt >= input.heartbeatMs;
}
