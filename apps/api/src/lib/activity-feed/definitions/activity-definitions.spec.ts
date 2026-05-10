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

  it.each([
    'class.session.rescheduled',
    'class.session.canceled',
    'session.reminder.sent',
    'session.feedback_request.sent',
  ])('does not define removed activity event %s', (eventType) => {
    expect(getActivityEventDefinition(eventType)).toBeUndefined();
  });
});
