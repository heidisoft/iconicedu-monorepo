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

describe('buildPersonalizedSessionCopy completion checks', () => {
  it('uses polite confirmation copy with lesson context', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.completion_check.sent',
      {
        title: 'Algebra',
        activityContext: {
          viewerRole: 'guardian',
          classTitle: 'Algebra',
          teacherNames: ['Ms. Chen'],
          studentNames: ['Priya'],
          viewerStudentNames: ['Priya'],
        },
      },
      'guardian-1',
    );

    expect(copy?.title).toBe('Confirm the lesson for Priya with Ms. Chen');
    expect(copy?.summary).toContain("How did Priya's class with Ms. Chen go?");
  });
});

describe('buildPersonalizedSessionCopy dispute reports', () => {
  it('words a wrongly-marked-complete report differently from a dispute', () => {
    const payload = { title: 'Algebra', reportedByDisplayName: 'Priya' };

    expect(
      buildPersonalizedSessionCopy(
        'session.completion.dispute_reported',
        payload,
        'staff-1',
      )?.title,
    ).toBe("Priya reported Algebra didn't happen");
    expect(
      buildPersonalizedSessionCopy(
        'session.completion.dispute_reported',
        { ...payload, reportKind: 'wrongly_completed' },
        'staff-1',
      ),
    ).toEqual({
      title: 'Priya reported Algebra was wrongly marked complete',
      summary: 'Tap to review the completion',
    });
  });
});
