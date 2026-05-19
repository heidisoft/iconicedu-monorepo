import { formatSessionReminderStartCopy } from '@iconicedu/api/lib/notifications/session-reminder-copy';

describe('formatSessionReminderStartCopy', () => {
  it('formats same-day reminders in the recipient timezone', () => {
    expect(
      formatSessionReminderStartCopy({
        startAt: '2030-03-06T21:00:00.000Z',
        now: new Date('2030-03-06T14:00:00.000Z'),
        payload: {
          viewerTimezone: 'America/New_York',
          timezone: 'UTC',
        },
      }),
    ).toBe('Class session starts today at 4:00 PM EST');
  });

  it('formats tomorrow reminders in the recipient timezone', () => {
    expect(
      formatSessionReminderStartCopy({
        startAt: '2030-03-07T04:00:00.000Z',
        now: new Date('2030-03-06T16:00:00.000Z'),
        payload: {
          recipientTimezone: 'Asia/Colombo',
          timezone: 'UTC',
        },
      }),
    ).toBe('Class session starts tomorrow at 9:30 AM GMT+5:30');
  });

  it('falls back to the schedule timezone', () => {
    expect(
      formatSessionReminderStartCopy({
        startAt: '2030-03-06T14:00:00.000Z',
        now: new Date('2030-03-01T14:00:00.000Z'),
        payload: {
          timezone: 'Europe/London',
        },
      }),
    ).toBe('Class session starts Wednesday, March 6 at 2:00 PM GMT');
  });
});
