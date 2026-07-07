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
    expect(copy?.summary).toContain('After 3 days');
  });
});

describe('buildPersonalizedSessionCopy session change requests', () => {
  it('describes restored session cancellations', () => {
    const copy = buildPersonalizedSessionCopy(
      'class.session.cancel_restored',
      {
        title: 'Algebra',
        restoredStartAt: '2030-03-06T21:00:00.000Z',
        viewerTimezone: 'America/New_York',
      },
      'guardian-1',
    );

    expect(copy).toEqual({
      title: 'Algebra',
      summary: 'Algebra session Mar 6 at 4:00 PM is back on the calendar.',
    });
  });

  it('describes reschedule approval requests', () => {
    const copy = buildPersonalizedSessionCopy(
      'class.session.reschedule_requested',
      {
        title: 'Algebra',
        requestedByName: 'Priya Parent',
        startAt: '2030-03-06T21:00:00.000Z',
        viewerTimezone: 'America/New_York',
      },
      'teacher-1',
    );

    expect(copy).toEqual({
      title: 'Algebra',
      summary: expect.stringContaining(
        'Priya Parent requested to reschedule this session',
      ),
    });
  });

  it('describes rejected change requests', () => {
    const copy = buildPersonalizedSessionCopy(
      'class.session.change_request.rejected',
      {
        title: 'Algebra',
        requestType: 'cancel',
        decidedByName: 'Ms. Chen',
      },
      'guardian-1',
    );

    expect(copy).toEqual({
      title: 'Algebra',
      summary: 'Ms. Chen declined the session cancellation request.',
    });
  });
});
