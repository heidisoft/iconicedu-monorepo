const CALLBACK_RUN_TTL_MS = 15_000;

export function shouldSkipCallbackRun(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  now = Date.now(),
  ttlMs = CALLBACK_RUN_TTL_MS,
): boolean {
  const previousRun = storage.getItem(key);
  if (previousRun) {
    const previousRunAt = Number(previousRun);
    if (Number.isFinite(previousRunAt) && now - previousRunAt < ttlMs) {
      return true;
    }
  }

  storage.setItem(key, String(now));
  return false;
}
