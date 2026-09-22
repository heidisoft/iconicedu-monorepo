// ─── Scheduled send helpers (issue #264 P2) ────────────────────────────────

/**
 * The device's IANA timezone, e.g. "America/New_York". `Intl.DateTimeFormat`
 * is available in Hermes/RN (verified against the app's RN 0.83 + Hermes
 * baseline), so no extra dependency (e.g. expo-localization) is needed just
 * for this. Falls back to null if resolution ever throws (some older/odd
 * environments) so callers can omit the timezone rather than crash.
 */
export function getDeviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Combines a local calendar date and a local time-of-day into a single
 * absolute Date. Both `datePart` and `timePart` are interpreted as local
 * wall-clock values (as produced by the native date/time pickers), and the
 * result is the same instant a `new Date(y, m, d, h, min)` construction
 * would produce — i.e. anchored to the device's current local timezone.
 */
export function combineDateAndTime(datePart: Date, timePart: Date): Date {
  const combined = new Date(datePart);
  combined.setHours(timePart.getHours(), timePart.getMinutes(), timePart.getSeconds(), 0);
  return combined;
}

/**
 * Computes the absolute `sendAt` ISO string (UTC) for a scheduled message,
 * given a local date and local time picked in the composer, plus the
 * device's timezone. The device timezone is what anchors the absolute
 * instant; it's also sent alongside for display purposes (formatting the
 * scheduled time back in the sender's original zone).
 */
export function computeSendAtIso(
  datePart: Date,
  timePart: Date,
): { sendAt: string; timezone: string | null } {
  const combined = combineDateAndTime(datePart, timePart);
  return {
    sendAt: combined.toISOString(),
    timezone: getDeviceTimezone(),
  };
}

export function isSendAtInFuture(sendAtIso: string, nowMs: number = Date.now()): boolean {
  const sendAtMs = Date.parse(sendAtIso);
  return Number.isFinite(sendAtMs) && sendAtMs > nowMs;
}

/** Formats a scheduled `sendAt` for display, using the stored timezone when present. */
export function formatScheduledSendAt(sendAt: string, timezone?: string | null): string {
  const date = new Date(sendAt);
  if (Number.isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const zone = timezone?.trim();
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      ...(zone ? { timeZone: zone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}
