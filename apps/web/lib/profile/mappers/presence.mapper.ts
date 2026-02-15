import type {
  LiveStatusVM,
  PresenceDisplayStatusVM,
  PresenceVM,
  ProfilePresenceRow,
} from '@iconicedu/shared-types';

const LIVE_STATUS_SET: ReadonlySet<LiveStatusVM> = new Set([
  'in_class',
  'teaching',
  'reviewing_work',
  'busy',
  'away',
  'offline',
]);

const DISPLAY_STATUS_SET: ReadonlySet<PresenceDisplayStatusVM> = new Set([
  'online',
  'idle',
  'busy',
  'away',
  'offline',
]);

const isLiveStatus = (value: string): value is LiveStatusVM =>
  LIVE_STATUS_SET.has(value as LiveStatusVM);

const isDisplayStatus = (value: string): value is PresenceDisplayStatusVM =>
  DISPLAY_STATUS_SET.has(value as PresenceDisplayStatusVM);

export function mapProfilePresenceRowToVM(
  row?: ProfilePresenceRow | null,
): PresenceVM | null {
  if (!row || row.deleted_at) {
    return null;
  }

  const liveStatusRaw = row.live_status?.trim();
  const displayStatusRaw = row.display_status?.trim();
  const liveStatus =
    liveStatusRaw && isLiveStatus(liveStatusRaw) ? liveStatusRaw : 'offline';
  const displayStatus =
    displayStatusRaw && isDisplayStatus(displayStatusRaw)
      ? displayStatusRaw
      : undefined;

  return {
    state: {
      text: row.state_text,
      emoji: row.state_emoji,
      expiresAt: row.state_expires_at,
    },
    liveStatus,
    displayStatus,
    lastSeenAt: row.last_seen_at,
    presenceLoaded: row.presence_loaded ?? undefined,
  };
}
