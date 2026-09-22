/**
 * Scheduled send (issue #264 P2) — helpers for composing an absolute sendAt
 * ISO timestamp from a local date + time picked in the composer, plus the
 * viewer's browser timezone.
 */

export interface ScheduleDraft {
  date: string; // yyyy-mm-dd, as produced by <input type="date">
  time: string; // HH:mm, as produced by <input type="time">
}

export function resolveBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Builds an absolute ISO sendAt from a local date/time draft, or null if the
 * draft is incomplete or does not parse to a valid date.
 */
export function buildScheduleSendAt(draft: ScheduleDraft): string | null {
  if (!draft.date || !draft.time) {
    return null;
  }
  const parsed = new Date(`${draft.date}T${draft.time}:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function isScheduleDraftInFuture(
  draft: ScheduleDraft,
  now: Date = new Date(),
): boolean {
  const sendAt = buildScheduleSendAt(draft);
  if (!sendAt) {
    return false;
  }
  return new Date(sendAt).getTime() > now.getTime();
}

export function getDefaultScheduleDraft(now: Date = new Date()): ScheduleDraft {
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const yyyy = inOneHour.getFullYear();
  const mm = String(inOneHour.getMonth() + 1).padStart(2, '0');
  const dd = String(inOneHour.getDate()).padStart(2, '0');
  const hh = String(inOneHour.getHours()).padStart(2, '0');
  const min = String(inOneHour.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}
