import type {
  CommandChannelPayload,
  FloatingReaction,
  NetworkLevel,
} from './zoom-video-session.types';

export function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function collapseNetworkLevel(level: number): NetworkLevel {
  if (level <= 1) return 'bad';
  if (level === 2) return 'normal';
  return 'good';
}

export function worseNetworkLevel(a: NetworkLevel, b: NetworkLevel): NetworkLevel {
  const rank: Record<NetworkLevel, number> = { bad: 0, normal: 1, good: 2 };
  return rank[a] <= rank[b] ? a : b;
}

export function getNetworkLevel(
  byUserId: Record<number, { uplink: NetworkLevel; downlink: NetworkLevel }>,
  userId: number | null,
): NetworkLevel | undefined {
  if (userId === null) return undefined;
  const entry = byUserId[userId];
  return entry ? worseNetworkLevel(entry.uplink, entry.downlink) : undefined;
}

export function getReactionOrigin(
  tile: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  overlay: Pick<DOMRect, 'left' | 'top'>,
) {
  return {
    x: tile.left + tile.width / 2 - overlay.left,
    y: tile.top + tile.height / 2 - overlay.top,
  };
}

export function createFloatingReaction(
  emoji: string,
  origin: FloatingReaction['origin'],
): FloatingReaction {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    emoji,
    origin,
    dx: Math.round((Math.random() - 0.5) * 160),
    rotate: Math.round((Math.random() - 0.5) * 50),
    durationMs: 2600 + Math.round(Math.random() * 900),
  };
}

export function formatRelativeTime(timestamp: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 60) return 'Now';
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} d ago`;
}

export function shouldUsePresentationLayout({
  hasActiveShareUser,
  isShowingLocalShare,
  isWhiteboardActive,
}: {
  hasActiveShareUser: boolean;
  isShowingLocalShare: boolean;
  isWhiteboardActive: boolean;
}) {
  return hasActiveShareUser || isShowingLocalShare || isWhiteboardActive;
}

export function parseParticipantCommand(senderId: string | number, text: string) {
  const userId = Number(senderId);
  if (!String(senderId).trim() || !Number.isSafeInteger(userId) || userId <= 0)
    return null;
  try {
    const payload: unknown = JSON.parse(text);
    if (!payload || typeof payload !== 'object' || !('type' in payload)) return null;
    if (
      (payload.type === 'raise-hand' &&
        'raised' in payload &&
        typeof payload.raised === 'boolean') ||
      payload.type === 'raise-hand-state-request' ||
      (payload.type === 'reaction' &&
        'emoji' in payload &&
        typeof payload.emoji === 'string' &&
        payload.emoji.length > 0)
    ) {
      return { userId, payload: payload as CommandChannelPayload };
    }
  } catch {
    return null;
  }
  return null;
}
