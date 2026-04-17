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

  it('personalizes dm.posted without requiring members', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.posted',
      {
        senderName: 'Jane',
        content: 'Can you review the homework before class?',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a direct message',
      summary: 'Can you review the homework before class?',
    });
  });

  it('personalizes dm.posted for an image shared via DM', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.posted',
      {
        senderName: 'Jane',
        content: 'Vacation photo',
        dmMessageKind: 'image',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you an image',
      summary: 'Vacation photo',
    });
  });

  it('personalizes dm.posted for audio shared via DM', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.posted',
      {
        senderName: 'Jane',
        content: 'Listen to this',
        dmMessageKind: 'audio',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a voice message',
      summary: 'Listen to this',
    });
  });

  it('personalizes dm.posted for a file shared via DM', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.posted',
      {
        senderName: 'Jane',
        content: 'See attachment',
        dmMessageKind: 'file',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a file',
      summary: 'See attachment',
    });
  });

  it('falls back for dm.posted when sender name is missing', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.posted',
      {
        content: 'Hello',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'New direct message',
      summary: 'Hello',
    });
  });

  it('truncates dm.posted content to 160 characters', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.posted',
      {
        senderName: 'Jane',
        content: 'a'.repeat(161),
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a direct message',
      summary: 'a'.repeat(160),
    });
  });

  it('uses the title as summary for dm.posted when content is empty', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.posted',
      {
        senderName: 'Jane',
        content: '',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a direct message',
      summary: 'Jane sent you a direct message',
    });
  });

  it('personalizes message.posted mentions with context title', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        senderName: 'Jane',
        content: 'Please check question 4.',
        learningSpaceTitle: 'Algebra 1',
        mentionedProfileId: 'child-1',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane mentioned you in Algebra 1',
      summary: 'Please check question 4.',
    });
  });

  it('personalizes message.posted thread replies with distinct copy', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        senderName: 'Jane',
        content: 'I replied in the thread',
        learningSpaceTitle: 'Algebra 1',
        threadReply: true,
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane replied to a thread in Algebra 1',
      summary: 'I replied in the thread',
    });
  });

  it('uses thread reply copy before mention copy for message.posted', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        senderName: 'Jane',
        content: 'See my reply',
        learningSpaceTitle: 'Algebra 1',
        mentionedProfileId: 'child-1',
        threadReply: true,
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane replied to a thread in Algebra 1',
      summary: 'See my reply',
    });
  });

  it('personalizes message.posted without a mention when context is present', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        senderName: 'Jane',
        content: 'Class starts at 4',
        learningSpaceTitle: 'Math',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a message in Math',
      summary: 'Class starts at 4',
    });
  });

  it('personalizes message.posted without a mention or context', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        senderName: 'Jane',
        content: 'Class starts at 4',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a message',
      summary: 'Class starts at 4',
    });
  });

  it('falls back to channelTopic for message.posted context', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        senderName: 'Jane',
        content: 'Welcome everyone',
        channelTopic: 'General',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane sent you a message in General',
      summary: 'Welcome everyone',
    });
  });

  it('personalizes message.posted mentions without context', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        senderName: 'Jane',
        content: 'Can you respond?',
        mentionedProfileId: 'p-1',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane mentioned you',
      summary: 'Can you respond?',
    });
  });

  it('falls back for message.posted when sender name is missing', () => {
    const copy = buildPersonalizedSessionCopy(
      'message.posted',
      {
        content: 'Hi',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'New message',
      summary: 'Hi',
    });
  });

  it('personalizes file.uploaded with sender and file count', () => {
    const copy = buildPersonalizedSessionCopy(
      'file.uploaded',
      {
        senderName: 'Jane',
        name: 'lesson-plan.pdf',
        fileCount: 3,
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane shared 3 files',
      summary: 'lesson-plan.pdf',
    });
  });

  it('personalizes file.uploaded for a single image with context', () => {
    const copy = buildPersonalizedSessionCopy(
      'file.uploaded',
      {
        senderName: 'Jane',
        name: 'photo.png',
        dmMessageKind: 'image',
        learningSpaceTitle: 'Math',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane shared an image in Math',
      summary: 'photo.png',
    });
  });

  it('personalizes file.uploaded for a single audio file with context', () => {
    const copy = buildPersonalizedSessionCopy(
      'file.uploaded',
      {
        senderName: 'Jane',
        name: 'voice-note.m4a',
        dmMessageKind: 'audio',
        learningSpaceTitle: 'Math',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane shared an audio file in Math',
      summary: 'voice-note.m4a',
    });
  });

  it('personalizes file.uploaded for multiple files with context', () => {
    const copy = buildPersonalizedSessionCopy(
      'file.uploaded',
      {
        senderName: 'Jane',
        name: 'worksheet.pdf',
        fileCount: 3,
        learningSpaceTitle: 'Math',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane shared 3 files in Math',
      summary: 'worksheet.pdf',
    });
  });

  it('uses content over name for file.uploaded summary', () => {
    const copy = buildPersonalizedSessionCopy(
      'file.uploaded',
      {
        senderName: 'Jane',
        name: 'doc.pdf',
        content: 'Worksheet 3',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane shared a file',
      summary: 'Worksheet 3',
    });
  });

  it('falls back for file.uploaded when sender name is missing', () => {
    const copy = buildPersonalizedSessionCopy(
      'file.uploaded',
      {
        name: 'doc.pdf',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'New file shared',
      summary: 'doc.pdf',
    });
  });

  it('personalizes dm.reaction.added with emoji', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.reaction.added',
      {
        senderName: 'Jane',
        emoji: '👍',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane reacted 👍 to your message',
      summary: 'Jane reacted 👍 to your message',
    });
  });

  it('personalizes dm.reaction.added without emoji', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.reaction.added',
      {
        senderName: 'Jane',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane reacted to your message',
      summary: 'Jane reacted to your message',
    });
  });

  it('falls back for dm.reaction.added when sender name is missing', () => {
    const copy = buildPersonalizedSessionCopy(
      'dm.reaction.added',
      {
        emoji: '👍',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'New reaction to your message',
      summary: 'New reaction to your message',
    });
  });

  it('personalizes reaction.added with context', () => {
    const copy = buildPersonalizedSessionCopy(
      'reaction.added',
      {
        senderName: 'Jane',
        emoji: '❤️',
        learningSpaceTitle: 'Math',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane reacted ❤️ to your message in Math',
      summary: 'Jane reacted ❤️ to your message in Math',
    });
  });

  it('personalizes reaction.added without context', () => {
    const copy = buildPersonalizedSessionCopy(
      'reaction.added',
      {
        senderName: 'Jane',
        emoji: '❤️',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'Jane reacted ❤️ to your message',
      summary: 'Jane reacted ❤️ to your message',
    });
  });

  it('falls back for reaction.added when sender name is missing', () => {
    const copy = buildPersonalizedSessionCopy(
      'reaction.added',
      {
        emoji: '❤️',
      },
      'child-1',
    );

    expect(copy).toEqual({
      title: 'New reaction to your message',
      summary: 'New reaction to your message',
    });
  });

  it('returns null for unsupported non-session event types', () => {
    const copy = buildPersonalizedSessionCopy(
      'announcement.posted',
      {
        title: 'Message posted',
        summary: 'A new message arrived',
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
