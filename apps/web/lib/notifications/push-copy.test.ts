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
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
        ],
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Your class with Mr. Kim starts in 5 min',
      summary: 'English class with Mr. Kim',
    });
  });

  it('personalizes session.reminder.sent for an educator with child name', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'English class',
        summary: 'Reminder',
        reminderOffsetMinutes: 30,
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
        ],
      },
      'educator-1',
    );

    expect(copy).toEqual({
      title: "Ava's class starts in 30 min",
      summary: 'English class with Ava',
    });
  });

  it('personalizes session.reminder.sent for guardian with both student and teacher names', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'English class',
        summary: 'Reminder',
        reminderOffsetMinutes: 5,
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
          { profileId: 'guardian-1', role: 'guardian', displayName: 'Parent' },
        ],
      },
      'guardian-1',
    );

    expect(copy).toEqual({
      title: "Ava's class with Mr. Kim starts in 5 min",
      summary: 'English class',
    });
  });

  it('personalizes session.reminder.sent for staff like guardian', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'English class',
        summary: 'Reminder',
        reminderOffsetMinutes: 30,
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
          { profileId: 'staff-1', role: 'staff', displayName: 'Coach' },
        ],
      },
      'staff-1',
    );

    expect(copy).toEqual({
      title: "Ava's class with Mr. Kim starts in 30 min",
      summary: 'English class',
    });
  });

  it('falls back to generic reminder copy for observer', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'English class',
        summary: 'Reminder',
        reminderOffsetMinutes: 5,
        members: [{ profileId: 'observer-1', role: 'observer', displayName: 'Observer' }],
      },
      'observer-1',
    );

    expect(copy).toEqual({
      title: 'Class starts in 5 minutes',
      summary: 'English class',
    });
  });

  it('falls back gracefully for child when educator displayName is missing', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'English class',
        summary: 'Reminder',
        reminderOffsetMinutes: 5,
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator' },
        ],
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Class starts in 5 minutes',
      summary: 'English class',
    });
  });

  it('falls back gracefully for educator when child displayName is missing', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'English class',
        summary: 'Reminder',
        reminderOffsetMinutes: 30,
        members: [
          { profileId: 'child-1', role: 'child' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
        ],
      },
      'educator-1',
    );

    expect(copy).toEqual({
      title: 'Class starts in 30 minutes',
      summary: 'English class',
    });
  });

  it('returns null when the recipient is not found', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      {
        title: 'English class',
        summary: 'Reminder',
        reminderOffsetMinutes: 5,
        members: [{ profileId: 'child-1', role: 'child', displayName: 'Ava' }],
      },
      'missing-profile',
    );

    expect(copy).toBeNull();
  });

  it('returns null when members are absent', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.reminder.sent',
      { title: 'English class', summary: 'Reminder', reminderOffsetMinutes: 5 },
      'child-1',
    );

    expect(copy).toBeNull();
  });

  it('personalizes feedback request for child with teacher name', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.feedback_request.sent',
      {
        title: 'English class',
        summary: 'Feedback',
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
        ],
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'How was your class with Mr. Kim?',
      summary: "Rate today's English class session",
    });
  });

  it('personalizes feedback request for educator with student name', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.feedback_request.sent',
      {
        title: 'English class',
        summary: 'Feedback',
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
        ],
      },
      'educator-1',
    );

    expect(copy).toEqual({
      title: 'How did Ava do?',
      summary: "Rate today's English class session",
    });
  });

  it('personalizes feedback request for guardian with both names', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.feedback_request.sent',
      {
        title: 'English class',
        summary: 'Feedback',
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
          { profileId: 'guardian-1', role: 'guardian', displayName: 'Parent' },
        ],
      },
      'guardian-1',
    );

    expect(copy).toEqual({
      title: "How was Ava's class with Mr. Kim?",
      summary: "Rate today's English class session",
    });
  });

  it('returns null for non-session event types', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        title: 'Message posted',
        summary: 'A new message arrived',
        reminderOffsetMinutes: 5,
        members: [{ profileId: 'child-1', role: 'child', displayName: 'Ava' }],
      },
      'child-1',
    );

    expect(copy).toBeNull();
  });

  it('returns null for supported event types not in session copy set', () => {
    const copy = buildPersonalizedSessionCopy(
      'session.started',
      {
        title: 'Session started',
        summary: 'Session began',
        members: [{ profileId: 'child-1', role: 'child', displayName: 'Ava' }],
      },
      'child-1',
    );

    expect(copy).toBeNull();
  });
});
