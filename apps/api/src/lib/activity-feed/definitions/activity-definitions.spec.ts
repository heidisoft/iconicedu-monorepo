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

    expect(rendered.headline.secondary).toBe('Algebra I for Priya with Ms. Chen');
    expect(rendered.summary).toBe('Context: Algebra I for Priya with Ms. Chen');
    expect(rendered.metadata?.viewerStudentNames).toEqual(['Priya']);
  });

  it.each([
    ['message.mentioned', { mentionedProfileId: 'guardian-1' }],
    ['message.thread_reply.posted', { threadId: 'thread-1', threadReply: true }],
    ['file.uploaded', { dmMessageKind: 'file', name: 'worksheet.pdf' }],
    ['image.uploaded', { dmMessageKind: 'image', name: 'photo.png' }],
    ['audio.uploaded', { dmMessageKind: 'audio', name: 'voice.webm' }],
  ] as const)('renders %s with its own projected verb', (eventType, payload) => {
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
  });

  it('renders teacher-facing class context with students', () => {
    const definition = getActivityEventDefinition('session.reminder.sent');
    expect(definition).toBeDefined();

    const rendered = definition!.render(
      makeEvent('session.reminder.sent', {
        summary: 'Class starts in 30 minutes',
        reminderOffsetMinutes: 30,
        activityContext: {
          classTitle: 'Algebra I',
          teacherNames: ['Ms. Chen'],
          studentNames: ['Priya', 'Mateo'],
          guardianNames: ['Anika Rao'],
          viewerRole: 'educator',
          viewerIsAdminStaff: false,
        },
      }),
    );

    expect(rendered.headline.secondary).toBe('Algebra I with Priya and Mateo');
    expect(rendered.summary).toBe(
      'Algebra I with Priya and Mateo Class starts in 30 minutes',
    );
    expect(rendered.metadata?.preserveActivitySummary).toBe(true);
  });

  it('renders admin/staff context with parents, students, teacher, and class', () => {
    const definition = getActivityEventDefinition('class.session.canceled');
    expect(definition).toBeDefined();

    const rendered = definition!.render(
      makeEvent('class.session.canceled', {
        canceledReason: 'weather',
        activityContext: {
          classTitle: 'Algebra I',
          teacherNames: ['Ms. Chen'],
          studentNames: ['Priya', 'Mateo'],
          guardianNames: ['Anika Rao'],
          viewerRole: 'staff',
          viewerIsAdminStaff: true,
        },
      }),
    );

    expect(rendered.headline.secondary).toBe(
      'Algebra I: Priya and Mateo, parents Anika Rao, teacher Ms. Chen',
    );
    expect(rendered.summary).toContain('Reason: weather.');
  });

  it.each([
    'class.session.rescheduled',
    'class.session.canceled',
    'session.reminder.sent',
    'session.feedback_request.sent',
  ])('adds contextual metadata for %s', (eventType) => {
    const definition = getActivityEventDefinition(eventType);
    expect(definition).toBeDefined();

    const rendered = definition!.render(makeEvent(eventType, {}));

    expect(rendered.metadata?.classTitle).toBe('Algebra I');
    expect(rendered.metadata?.teacherNames).toEqual(['Ms. Chen']);
    expect(rendered.metadata?.studentNames).toEqual(['Priya', 'Mateo']);
  });
});
