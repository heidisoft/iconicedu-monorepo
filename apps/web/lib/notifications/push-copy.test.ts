import { describe, expect, it } from 'vitest';

import { buildPersonalizedSessionCopy } from './push-copy';

describe('buildPersonalizedSessionCopy', () => {
  it('personalizes session.reminder.sent for a child with teacher name', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'English class',
        summary: 'Reminder',
        reminderOffsetMinutes: 5,
        occurrenceStart: '2026-04-22T19:30:00.000Z',
        viewerTimezone: 'America/New_York',
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
        ],
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'English class with Mr. Kim starts in 5 min',
      summary: 'Apr 22 at 3:30 PM',
    });
  });

  it('personalizes dm.posted for file-like direct messages', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.posted',
      {
        senderName: 'Jane',
        content: 'See attached',
        dmMessageKind: 'file',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a file',
      summary: 'See attached',
    });
  });

  it('personalizes message.posted mentions with context title', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        senderName: 'Jane',
        content: '@you hello',
        mentionedProfileId: 'child-1',
        learningSpaceTitle: 'Math',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane mentioned you in Math',
      summary: '@you hello',
    });
  });

  it('builds class.session.rescheduled copy for guardians with local time and reason', () => {
    const copy = buildPersonalizedSessionCopy(
      'class.session.rescheduled',
      {
        title: 'Algebra 1',
        viewerTimezone: 'America/New_York',
        rescheduledFromStartAt: '2026-04-21T18:00:00.000Z',
        rescheduledToStartAt: '2026-04-22T19:30:00.000Z',
        reason: 'Teacher unavailable',
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
          { profileId: 'guardian-1', role: 'guardian', displayName: 'Parent' },
        ],
      },
      'guardian-1',
    );

    expect(copy).toEqual({
      title: 'Algebra 1 for Ava with Mr. Kim rescheduled',
      summary:
        'Moved from Apr 21 at 2:00 PM to Apr 22 at 3:30 PM. Reason: Teacher unavailable.',
    });
  });

  it('builds class.session.canceled copy for educators with local time and reason', () => {
    const copy = buildPersonalizedSessionCopy(
      'class.session.canceled',
      {
        title: 'Algebra 1',
        recipientTimezone: 'America/Los_Angeles',
        canceledStartAt: '2026-04-22T19:30:00.000Z',
        canceledReason: 'Student sick',
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
        ],
      },
      'educator-1',
    );

    expect(copy).toEqual({
      title: 'Algebra 1 with Ava cancelled',
      summary: 'Canceled for Apr 22 at 12:30 PM. Reason: Student sick.',
    });
  });

  it('builds payment.reminder.sent copy from payload title and summary', () => {
    const copy = buildPersonalizedSessionCopy(
      'payment.reminder.sent',
      {
        title: 'Payment reminder',
        summary: 'Invoice #1234 is due tomorrow.',
      },
      'guardian-1',
    );

    expect(copy).toEqual({
      title: 'Payment reminder',
      summary: 'Invoice #1234 is due tomorrow.',
    });
  });

  it('returns null for removed or unsupported event types', () => {
    expect(
      buildPersonalizedSessionCopy(
        'file.uploaded',
        {
          senderName: 'Jane',
          name: 'lesson-plan.pdf',
        },
        'child-1',
      ),
    ).toBeNull();

    expect(
      buildPersonalizedSessionCopy(
        'system.notice',
        {
          title: 'Scheduled maintenance',
          message: 'Maintenance tonight.',
        },
        'guardian-1',
      ),
    ).toBeNull();
  });
});
