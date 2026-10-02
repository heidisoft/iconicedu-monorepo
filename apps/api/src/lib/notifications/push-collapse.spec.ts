import { buildReminderPushCollapseId } from '@iconicedu/api/lib/notifications/push-collapse';

describe('buildReminderPushCollapseId', () => {
  const dedupeKey =
    'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:30';

  it('is deterministic for the same reminder dedupe key', () => {
    expect(buildReminderPushCollapseId(dedupeKey)).toBe(
      buildReminderPushCollapseId(dedupeKey),
    );
  });

  it('stays within the 64-byte APNs collapse id limit', () => {
    const collapseId = buildReminderPushCollapseId(dedupeKey) ?? '';

    expect(collapseId.length).toBeGreaterThan(0);
    expect(Buffer.byteLength(collapseId, 'utf8')).toBeLessThanOrEqual(64);
  });

  it('separates reminders that differ only by offset', () => {
    const thirtyMinutes = buildReminderPushCollapseId(dedupeKey);
    const twelveHours = buildReminderPushCollapseId(
      'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:720',
    );

    expect(thirtyMinutes).not.toBe(twelveHours);
  });

  it('separates reminders that differ only by occurrence', () => {
    const original = buildReminderPushCollapseId(dedupeKey);
    const rescheduled = buildReminderPushCollapseId(
      'session.reminder:org-1:space-1:channel-1:2030-03-06T11:00:00.000Z:30',
    );

    expect(original).not.toBe(rescheduled);
  });

  it('separates reminders that differ only by org', () => {
    const orgOne = buildReminderPushCollapseId(dedupeKey);
    const orgTwo = buildReminderPushCollapseId(
      'session.reminder:org-2:space-1:channel-1:2030-03-06T10:00:00.000Z:30',
    );

    expect(orgOne).not.toBe(orgTwo);
  });

  it('returns undefined for a missing or blank dedupe key', () => {
    expect(buildReminderPushCollapseId('')).toBeUndefined();
    expect(buildReminderPushCollapseId('   ')).toBeUndefined();
  });
});
