import { createHash } from 'crypto';

// Expo forwards `collapseId` as the APNs `apns-collapse-id` header and as the
// FCM `collapse_key`. APNs rejects a collapse id longer than 64 bytes, and a
// reminder dedupe key
// (`session.reminder:<org>:<space>:<channel>:<occurrenceStart>:<offset>`) is
// comfortably past that, so the key is hashed into a short stable id instead of
// being sent verbatim.
const COLLAPSE_ID_PREFIX = 'reminder-';
const COLLAPSE_ID_HASH_LENGTH = 32;

/**
 * Builds the deterministic tray collapse id for one reminder.
 *
 * The same dedupe key always produces the same collapse id, so a resend of the
 * same reminder replaces the earlier notification on the device instead of
 * stacking a second copy next to it. Different reminders — a different
 * occurrence, offset, channel, or org — hash differently and keep their own
 * slot in the tray.
 */
export function buildReminderPushCollapseId(dedupeKey: string): string | undefined {
  const normalized = dedupeKey.trim();
  if (!normalized) {
    return undefined;
  }

  const digest = createHash('sha256').update(normalized).digest('hex');
  return `${COLLAPSE_ID_PREFIX}${digest.slice(0, COLLAPSE_ID_HASH_LENGTH)}`;
}
