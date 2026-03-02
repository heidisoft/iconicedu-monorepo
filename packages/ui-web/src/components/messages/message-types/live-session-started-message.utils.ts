import type { LiveSessionStartedMessageVM } from '@iconicedu/shared-types';

const DEFAULT_LIVE_SESSION_DURATION_MS = 30 * 60 * 1000;

export function isLiveSessionJoinDisabled(
  message: LiveSessionStartedMessageVM,
  now = Date.now(),
): boolean {
  if (message.liveSession.status === 'ended') {
    return true;
  }

  const startedAt = Date.parse(message.liveSession.startedAt);
  const endsAt = message.liveSession.endsAt ? Date.parse(message.liveSession.endsAt) : Number.NaN;
  const effectiveEndsAt = Number.isFinite(endsAt)
    ? endsAt
    : Number.isFinite(startedAt)
      ? startedAt + DEFAULT_LIVE_SESSION_DURATION_MS
      : Number.NaN;

  return Number.isFinite(effectiveEndsAt) && effectiveEndsAt <= now;
}

export function getLiveSessionStartedMessageState(message: LiveSessionStartedMessageVM, now = Date.now()) {
  const ended = isLiveSessionJoinDisabled(message, now);
  return {
    ended,
    title: ended ? 'Class ended' : message.liveSession.title,
    buttonLabel: ended ? 'Class ended' : 'Join',
    buttonClassName: ended
      ? 'border-border/70 bg-muted text-muted-foreground'
      : undefined,
  };
}
