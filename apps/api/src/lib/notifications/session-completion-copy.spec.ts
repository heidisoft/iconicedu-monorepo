import { buildSessionCompletionCopy } from '@iconicedu/api/lib/notifications/session-completion-copy';

describe('buildSessionCompletionCopy', () => {
  it('asks parents to confirm the lesson for their child with the tutor', () => {
    const copy = buildSessionCompletionCopy({
      activityContext: {
        viewerRole: 'guardian',
        teacherNames: ['Ms. Chen'],
        studentNames: ['Priya'],
        viewerStudentNames: ['Priya'],
      },
    });

    expect(copy.title).toBe(
      'Please take a moment to confirm the lesson for Priya with Ms. Chen',
    );
    expect(copy.summary).toContain("How did Priya's class with Ms. Chen go?");
    expect(copy.summary).toContain('credits can be released to the teacher');
  });

  it('asks tutors to confirm the lesson with the student', () => {
    const copy = buildSessionCompletionCopy({
      activityContext: {
        viewerRole: 'educator',
        teacherNames: ['Ms. Chen'],
        studentNames: ['Priya'],
      },
    });

    expect(copy.title).toBe('Please take a moment to confirm your lesson with Priya');
    expect(copy.summary).toContain('How did your class with Priya go?');
  });

  it('asks students to confirm the lesson with the tutor', () => {
    const copy = buildSessionCompletionCopy({
      activityContext: {
        viewerRole: 'child',
        teacherNames: ['Ms. Chen'],
        studentNames: ['Priya'],
      },
    });

    expect(copy.title).toBe('Please take a moment to confirm your lesson with Ms. Chen');
    expect(copy.summary).toContain('How did your class with Ms. Chen go?');
  });
});
