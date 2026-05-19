import { buildPersonalizedSessionCopy } from '@iconicedu/api/lib/notifications/push-copy';

describe('buildPersonalizedSessionCopy session reminders', () => {
  it('includes child and tutor names for parent reminders', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'Algebra',
        startAt: '2030-03-06T21:00:00.000Z',
        viewerTimezone: 'America/New_York',
        activityContext: {
          viewerRole: 'guardian',
          classTitle: 'Algebra',
          teacherNames: ['Ms. Chen'],
          studentNames: ['Priya', 'Maya'],
          viewerStudentNames: ['Priya', 'Maya'],
        },
      },
      'guardian-1',
    );

    expect(copy).toEqual({
      title: 'Algebra for Priya and Maya with Ms. Chen',
      summary: expect.stringContaining('Algebra for Priya and Maya with Ms. Chen'),
    });
    expect(copy?.summary).not.toContain('starts soon');
  });

  it('includes student names for tutor reminders', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'Algebra',
        startAt: '2030-03-06T21:00:00.000Z',
        viewerTimezone: 'America/New_York',
        activityContext: {
          viewerRole: 'educator',
          classTitle: 'Algebra',
          teacherNames: ['Ms. Chen'],
          studentNames: ['Priya'],
        },
      },
      'teacher-1',
    );

    expect(copy?.title).toBe('Algebra with Priya');
    expect(copy?.summary).toContain('Algebra with Priya');
  });

  it('includes tutor names for student reminders', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'Algebra',
        startAt: '2030-03-06T21:00:00.000Z',
        viewerTimezone: 'America/New_York',
        activityContext: {
          viewerRole: 'child',
          classTitle: 'Algebra',
          teacherNames: ['Ms. Chen'],
          studentNames: ['Priya'],
        },
      },
      'student-1',
    );

    expect(copy?.title).toBe('Algebra with Ms. Chen');
    expect(copy?.summary).toContain('Algebra with Ms. Chen');
  });
});
