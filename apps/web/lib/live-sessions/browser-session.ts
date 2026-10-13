const STORAGE_PREFIX = 'iconicedu:live-session:';
const DEFAULT_RECOVERY_WINDOW_MS = 12 * 60 * 60 * 1000;

export type LiveSessionRecovery<T = undefined> = {
  joinedAt: number;
  expiresAt: number;
  muted: boolean;
  videoOff: boolean;
  payload?: T;
};

function storageKey(sessionId: string) {
  return `${STORAGE_PREFIX}${sessionId}`;
}

export function readLiveSessionRecovery<T = undefined>(
  sessionId: string,
): LiveSessionRecovery<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(sessionId));
    if (!raw) return null;

    const value = JSON.parse(raw) as Partial<LiveSessionRecovery<T>>;
    if (
      typeof value.joinedAt !== 'number' ||
      typeof value.expiresAt !== 'number' ||
      typeof value.muted !== 'boolean' ||
      typeof value.videoOff !== 'boolean' ||
      value.expiresAt <= Date.now()
    ) {
      window.sessionStorage.removeItem(storageKey(sessionId));
      return null;
    }

    return value as LiveSessionRecovery<T>;
  } catch {
    return null;
  }
}

export function rememberLiveSession<T = undefined>(
  sessionId: string,
  preferences: { muted: boolean; videoOff: boolean },
  options?: { expiresAt?: string | null; payload?: T },
) {
  if (typeof window === 'undefined') return;
  try {
    const parsedExpiry = options?.expiresAt ? Date.parse(options.expiresAt) : Number.NaN;
    const now = Date.now();
    const expiresAt = Number.isFinite(parsedExpiry)
      ? parsedExpiry
      : now + DEFAULT_RECOVERY_WINDOW_MS;

    window.sessionStorage.setItem(
      storageKey(sessionId),
      JSON.stringify({
        joinedAt: now,
        expiresAt,
        muted: preferences.muted,
        videoOff: preferences.videoOff,
        ...(options && 'payload' in options ? { payload: options.payload } : {}),
      } satisfies LiveSessionRecovery<T>),
    );
  } catch {
    // Recovery is progressive enhancement; joining must still work when
    // storage is disabled or full.
  }
}

export function clearLiveSessionRecovery(sessionId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey(sessionId));
  } catch {
    // Leaving must not be blocked by browser storage failures.
  }
}
