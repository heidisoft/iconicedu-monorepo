import { describe, expect, it } from 'vitest';

import { getActivityEventDefinition } from '@iconicedu/web/lib/activity-feed/definitions/activity-definitions';

describe('activity event definitions', () => {
  it('adds a channel link for posted messages', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition) {
      throw new Error('Missing message.posted definition');
    }

    const rendered = definition.render({
      id: 'event-1',
      org_id: 'org-1',
      event_type: 'message.posted',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: { kind: 'message', id: 'message-1' },
      target_ref: null,
      payload: {
        channelId: 'channel-1',
        messageId: 'message-1',
        senderName: 'Jane',
        content: 'Hello there',
      },
      audience_rules: [],
      dedupe_key: 'message.posted:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.actionButton).toEqual({
      label: 'Open channel',
      variant: 'outline',
      href: '../c/channel-1',
    });
  });

  it('routes class-scoped message activities to the learning space page', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition) {
      throw new Error('Missing message.posted definition');
    }

    const rendered = definition.render({
      id: 'event-3',
      org_id: 'org-1',
      event_type: 'message.posted',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-1' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-1',
        senderName: 'Jane',
        content: 'Hello class',
        learningSpaceId: 'space-1',
        learningSpaceTitle: 'Algebra I',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key: 'message.posted:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.secondary).toBe('Algebra I');
    expect(rendered.actionButton).toEqual({
      label: 'Open class',
      variant: 'outline',
      href: '../spaces/channel-1',
    });
  });

  it('adds a class link for learning-space events', () => {
    const definition = getActivityEventDefinition('class.created');
    if (!definition) {
      throw new Error('Missing class.created definition');
    }

    const rendered = definition.render({
      id: 'event-2',
      org_id: 'org-1',
      event_type: 'class.created',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Algebra I',
      },
      audience_rules: [],
      dedupe_key: 'class.created:space-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.actionButton).toEqual({
      label: 'Open class',
      variant: 'outline',
      href: '../spaces/channel-1',
    });
  });

  it('groups class file uploads into hourly class buckets', () => {
    const definition = getActivityEventDefinition('file.uploaded');
    if (!definition?.group) {
      throw new Error('Missing file.uploaded group definition');
    }

    const event = {
      id: 'event-4',
      org_id: 'org-1',
      event_type: 'file.uploaded',
      occurred_at: '2026-03-03T12:34:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-1' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        learningSpaceTitle: 'Algebra I',
        channelId: 'channel-1',
        name: 'brief.pdf',
      },
      audience_rules: [],
      dedupe_key: 'file.uploaded:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:34:00.000Z',
      updated_at: '2026-03-03T12:34:00.000Z',
    };

    expect(definition.group.buildGroupKey(event)).toBe('files:space-1:2026-03-03T12');
    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: 'New class files',
        secondary: 'Algebra I',
      },
    });
  });

  it('renders homework activities using the assignment pattern and weekly grouping', () => {
    const definition = getActivityEventDefinition('homework.assigned');
    if (!definition?.group) {
      throw new Error('Missing homework.assigned definition');
    }

    const event = {
      id: 'event-5',
      org_id: 'org-1',
      event_type: 'homework.assigned',
      occurred_at: '2026-03-03T12:34:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-5' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        learningSpaceTitle: 'Algebra I',
        channelId: 'channel-1',
        title: 'Fractions Practice Set',
        description: 'Focus on equivalent fractions and number lines.',
        dueAt: '2026-03-09T15:00:00.000Z',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key: 'homework.assigned:message-5',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:34:00.000Z',
      updated_at: '2026-03-03T12:34:00.000Z',
    };

    expect(definition.group.buildGroupKey(event)).toBe('homework:space-1:2026-03-02');
    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: 'Homework updates',
        secondary: 'Algebra I',
      },
    });
    expect(definition.render(event)).toMatchObject({
      headline: {
        primary: 'New homework assigned',
        secondary: 'Fractions Practice Set',
      },
      summary: 'Due Mar 9',
      actionButton: {
        label: 'View homework',
        variant: 'default',
        href: '../spaces/channel-1',
      },
      expandedContent: 'Focus on equivalent fractions and number lines.',
    });
  });
});
