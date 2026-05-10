import type { ActivityEventRow } from '@iconicedu/shared-types';
import { getActivityEventDefinition } from '@iconicedu/api/lib/activity-feed/definitions/activity-definitions';

function makeEvent(
  eventType: string,
  payload: Record<string, unknown>,
): ActivityEventRow {
  return {
    id: `event-${eventType}`,
    org_id: 'org-1',
    event_type: eventType,
    occurred_at: '2026-05-05T12:00:00.000Z',
    source_kind: 'system',
    actor_profile_id: 'teacher-1',
    scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
    object_ref: null,
    target_ref: { kind: 'learning_space', id: 'space-1' },
    payload: {
      channelId: 'channel-1',
      learningSpaceId: 'space-1',
      title: 'Algebra I',
      channelRouteKind: 'space',
      activityContext: {
        classTitle: 'Algebra I',
        contextTitle: 'Algebra I',
        teacherNames: ['Ms. Chen'],
        studentNames: ['Priya', 'Mateo'],
        guardianNames: ['Anika Rao'],
        viewerStudentNames: ['Priya'],
        viewerRole: 'guardian',
        viewerIsAdminStaff: false,
      },
      ...payload,
    },
    audience_rules: [],
    dedupe_key: `dedupe-${eventType}`,
    projection_status: 'pending',
    projection_attempts: 0,
    created_at: '2026-05-05T12:00:00.000Z',
    updated_at: '2026-05-05T12:00:00.000Z',
  };
}

describe('API activity definitions context rendering', () => {
  it('renders message context for guardians', () => {
    const definition = getActivityEventDefinition('message.posted');
    expect(definition).toBeDefined();

    const rendered = definition!.render(
      makeEvent('message.posted', {
        senderName: 'Ms. Chen',
        messageId: 'message-1',
        content: 'Please review the worksheet.',
      }),
    );

    expect(rendered.headline.primary).toBe('Ms. Chen');
    expect(rendered.headline.secondary).toBe(
      'sent a message in Algebra I for Priya with Ms. Chen',
    );
    expect(rendered.summary).toBe('Please review the worksheet.');
    expect(rendered.metadata?.viewerStudentNames).toEqual(['Priya']);
  });

  it.each([
    ['message.mentioned', { mentionedProfileId: 'guardian-1' }, 'AtSign'],
    [
      'message.thread_reply.posted',
      { threadId: 'thread-1', threadReply: true },
      'MessageSquareReply',
    ],
    ['file.uploaded', { dmMessageKind: 'file', name: 'worksheet.pdf' }, 'FileBadge'],
    ['image.uploaded', { dmMessageKind: 'image', name: 'photo.png' }, 'BookImage'],
    ['audio.uploaded', { dmMessageKind: 'audio', name: 'voice.webm' }, 'FileHeadphone'],
  ] as const)('renders %s with its own projected verb', (eventType, payload, iconKey) => {
    const definition = getActivityEventDefinition(eventType);
    expect(definition).toBeDefined();

    const rendered = definition!.render(
      makeEvent(eventType, {
        senderName: 'Ms. Chen',
        messageId: 'message-1',
        content: 'Please review the worksheet.',
        ...payload,
      }),
    );

    expect(rendered.verb).toBe(eventType);
    expect(rendered.leading?.kind === 'icon' ? rendered.leading.iconKey : null).toBe(
      iconKey,
    );
  });

  it('renders direct messages with direct-message copy and reply action', () => {
    const definition = getActivityEventDefinition('message.posted');
    expect(definition).toBeDefined();

    const rendered = definition!.render(
      makeEvent('message.posted', {
        senderName: 'Priya',
        channelRouteKind: 'dm',
        channelTopic: null,
        learningSpaceTitle: null,
        title: null,
        activityContext: {},
        content: 'Can we move the lesson?',
      }),
    );

    expect(rendered.leading?.kind === 'icon' ? rendered.leading.iconKey : null).toBe(
      'MessagesSquare',
    );
    expect(rendered.headline).toMatchObject({
      primary: 'Priya',
      secondary: 'sent you a direct message',
    });
    expect(rendered.summary).toBe('Can we move the lesson?');
    expect(rendered.actionButton?.label).toBe('Reply');
  });

  it('renders reactions with original message preview and quiet importance', () => {
    const definition = getActivityEventDefinition('reaction.added');
    expect(definition).toBeDefined();

    const rendered = definition!.render(
      makeEvent('reaction.added', {
        senderName: 'Priya',
        emoji: '👍',
        messagePreview: 'Thanks for the update.',
      }),
    );

    expect(definition!.importance).toBe('normal');
    expect(rendered.leading?.kind === 'icon' ? rendered.leading.iconKey : null).toBe(
      'SmilePlus',
    );
    expect(rendered.headline.primary).toBe(
      'Priya reacted 👍 to your message in Algebra I for Priya with Ms. Chen',
    );
    expect(rendered.summary).toBe('Your message: Thanks for the update.');
    expect(rendered.actionButton?.label).toBe('View message');
  });

  it('marks mentions as important and message posts as immediate push', () => {
    expect(getActivityEventDefinition('message.mentioned')?.importance).toBe('important');
    expect(getActivityEventDefinition('message.posted')?.notification?.timing).toBe(
      'immediate',
    );
  });

  it('renders class session reschedule with parent role context', () => {
    const definition = getActivityEventDefinition('class.session.rescheduled');
    expect(definition).toBeDefined();

    const rendered = definition!.render(
      makeEvent('class.session.rescheduled', {
        rescheduledFromStartAt: '2026-05-07T14:00:00.000Z',
        rescheduledToStartAt: '2026-05-08T15:00:00.000Z',
        rescheduledReason: 'Teacher conflict',
      }),
    );

    expect(definition!.tabKey).toBe('classes');
    expect(definition!.importance).toBe('important');
    expect(definition!.notification).toMatchObject({
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    });
    expect(rendered.leading?.kind === 'icon' ? rendered.leading.iconKey : null).toBe(
      'CalendarCheck',
    );
    expect(rendered.headline).toMatchObject({
      primary: 'Algebra I rescheduled',
      secondary: 'For Priya with Ms. Chen',
    });
    expect(rendered.summary).toContain('was moved to');
    expect(rendered.expandedContent).toBe('Reason: Teacher conflict');
    expect(rendered.actionButton?.label).toBe('Open class');
  });

  it('renders class session canceled with warning tone', () => {
    const definition = getActivityEventDefinition('class.session.canceled');
    expect(definition).toBeDefined();

    const rendered = definition!.render(
      makeEvent('class.session.canceled', {
        canceledStartAt: '2026-05-07T14:00:00.000Z',
        canceledReason: 'Holiday',
      }),
    );

    expect(rendered.leading).toMatchObject({
      kind: 'icon',
      iconKey: 'CalendarX',
      tone: 'warning',
    });
    expect(rendered.headline.primary).toBe('Algebra I canceled');
    expect(rendered.headline.secondary).toBe('For Priya with Ms. Chen');
    expect(rendered.summary).toContain('was canceled');
  });

  it('renders session reminders and feedback requests in the classes tab', () => {
    const reminderDefinition = getActivityEventDefinition('session.reminder.sent');
    const feedbackDefinition = getActivityEventDefinition(
      'session.feedback_request.sent',
    );

    const reminder = reminderDefinition!.render(
      makeEvent('session.reminder.sent', {
        startAt: '2026-05-07T14:00:00.000Z',
      }),
    );
    const feedback = feedbackDefinition!.render(
      makeEvent('session.feedback_request.sent', {}),
    );

    expect(reminderDefinition?.tabKey).toBe('classes');
    expect(reminderDefinition?.notification).toMatchObject({
      defaultChannels: ['push'],
      timing: 'immediate',
    });
    expect(reminder.headline).toMatchObject({
      primary: 'Algebra I starting soon',
      secondary: 'For Priya with Ms. Chen',
    });
    expect(reminder.expandedContent).toBeUndefined();
    expect(reminder.actionButton?.label).toBe('Open class');

    expect(feedbackDefinition?.tabKey).toBe('classes');
    expect(feedbackDefinition?.notification).toMatchObject({
      defaultChannels: ['push', 'email'],
      timing: 'standard',
    });
    expect(feedback.leading).toMatchObject({
      kind: 'icon',
      iconKey: 'MessageSquareHeart',
      tone: 'info',
    });
    expect(feedback.headline.primary).toBe('Share feedback for Algebra I');
    expect(feedback.summary).toBe('Tell us how the session went');
    expect(feedback.expandedContent).toBeUndefined();
    expect(feedback.actionButton?.label).toBe('Give feedback');
  });

  it('only sets session expanded content when payload content exists', () => {
    const reminderDefinition = getActivityEventDefinition('session.reminder.sent');
    const feedbackDefinition = getActivityEventDefinition(
      'session.feedback_request.sent',
    );

    const reminder = reminderDefinition!.render(
      makeEvent('session.reminder.sent', {
        joinDetails: 'Join with the class Zoom link.',
      }),
    );
    const feedback = feedbackDefinition!.render(
      makeEvent('session.feedback_request.sent', {
        feedbackPrompt: 'Rate the session and leave a note.',
      }),
    );

    expect(reminder.expandedContent).toBe('Join with the class Zoom link.');
    expect(feedback.expandedContent).toBe('Rate the session and leave a note.');
  });

  it.each([
    ['guardian', ['Rhea', 'Nico'], ['Ms. Denise'], [], 'For Rhea + 1 with Ms. Denise'],
    [
      'educator',
      ['Rhea', 'Nico', 'Ari', 'Sam'],
      ['Ms. Denise'],
      [],
      'With Rhea + 3 students',
    ],
    ['child', ['Rhea'], ['Ms. Denise', 'Mr. Lee'], [], 'With Ms. Denise + 1'],
    [
      'staff',
      ['Rhea', 'Nico', 'Ari'],
      ['Ms. Denise', 'Mr. Lee'],
      ['Hesh', 'Maya'],
      'Parent: Hesh + 1 · Student: Rhea + 2 · Teacher: Ms. Denise + 1',
    ],
  ])(
    'formats %s role context for session events',
    (viewerRole, studentNames, teacherNames, guardianNames, expected) => {
      const definition = getActivityEventDefinition('session.reminder.sent');
      const rendered = definition!.render(
        makeEvent('session.reminder.sent', {
          activityContext: {
            classTitle: 'Piano',
            contextTitle: 'Piano',
            viewerRole,
            viewerIsAdminStaff: viewerRole === 'staff',
            studentNames,
            viewerStudentNames: viewerRole === 'guardian' ? studentNames : [],
            teacherNames,
            guardianNames,
          },
        }),
      );

      expect(rendered.headline.secondary).toBe(expected);
    },
  );
});
