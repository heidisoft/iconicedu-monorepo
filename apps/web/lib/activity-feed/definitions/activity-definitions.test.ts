import { describe, expect, it } from 'vitest';

import {
  getActivityEventDefinition,
  listActivityEventDefinitionTypes,
} from '@iconicedu/web/lib/activity-feed/definitions/activity-definitions';

describe('activity event definitions', () => {
  it('lists only the supported reactive activity event types', () => {
    expect(listActivityEventDefinitionTypes()).toEqual([
      'class.session.canceled',
      'class.session.rescheduled',
      'class.sessions.canceled',
      'class.sessions.rescheduled',
      'dm.posted',
      'message.posted',
      'reaction.added',
      'session.feedback_request.sent',
      'session.reminder.sent',
      'sessions.feedback_request.sent',
      'sessions.reminder.sent',
    ]);

    expect(getActivityEventDefinition('class.created')).toBeUndefined();
    expect(getActivityEventDefinition('member.removed')).toBeUndefined();
    expect(getActivityEventDefinition('legacy.started.removed')).toBeUndefined();
    expect(getActivityEventDefinition('legacy.removed')).toBeUndefined();
  });

  it('renders direct message activities with an open conversation button', () => {
    const definition = getActivityEventDefinition('dm.posted');
    if (!definition) {
      throw new Error('Missing dm.posted definition');
    }

    const rendered = definition.render({
      id: 'event-dm-1',
      org_id: 'org-1',
      event_type: 'dm.posted',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-dm-1' },
      object_ref: { kind: 'message', id: 'message-1' },
      target_ref: null,
      payload: {
        channelId: 'channel-dm-1',
        messageId: 'message-1',
        senderName: 'Jane',
        content: 'Hello there',
        channelTopic: 'Priya + Riley',
        channelRouteKind: 'dm',
        orgSlug: 'iconic-academy',
      },
      audience_rules: [],
      dedupe_key: 'dm.posted:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Jane sent you a direct message in');
    expect(rendered.actionButton).toEqual({
      label: 'Open conversation',
      variant: 'outline',
      href: '/iconic-academy/dm/channel-dm-1',
    });
  });

  it('renders mentioned channel messages as standalone message items', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition) {
      throw new Error('Missing message.posted definition');
    }

    const rendered = definition.render({
      id: 'event-message-mention-1',
      org_id: 'org-1',
      event_type: 'message.posted',
      occurred_at: '2026-03-03T12:45:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: { kind: 'message', id: 'message-2' },
      target_ref: null,
      payload: {
        channelId: 'channel-1',
        messageId: 'message-2',
        senderName: 'Jane',
        content: '@you hello',
        channelTopic: 'Support',
        mentionedProfileId: 'profile-2',
      },
      audience_rules: [],
      dedupe_key: 'message.mention:message-2:profile-2',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:45:00.000Z',
      updated_at: '2026-03-03T12:45:00.000Z',
    });

    expect(rendered.verb).toBe('message.posted');
    expect(rendered.headline.primary).toBe('Jane mentioned you in');
    expect(rendered.expandedContent).toBe('@you hello');
  });

  it('renders reactions as standalone reaction items', () => {
    const definition = getActivityEventDefinition('reaction.added');
    if (!definition) {
      throw new Error('Missing reaction.added definition');
    }

    const dmReaction = definition.render({
      id: 'event-dm-reaction-1',
      org_id: 'org-1',
      event_type: 'reaction.added',
      occurred_at: '2026-03-03T12:25:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-dm-1' },
      object_ref: { kind: 'message', id: 'message-1' },
      target_ref: null,
      payload: {
        channelId: 'channel-dm-1',
        messageId: 'message-1',
        senderName: 'Jane',
        emoji: '👍',
        channelRouteKind: 'dm',
      },
      audience_rules: [],
      dedupe_key: null,
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:25:00.000Z',
      updated_at: '2026-03-03T12:25:00.000Z',
    });

    const channelReaction = definition.render({
      id: 'event-channel-reaction-1',
      org_id: 'org-1',
      event_type: 'reaction.added',
      occurred_at: '2026-03-03T12:25:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: { kind: 'message', id: 'message-2' },
      target_ref: null,
      payload: {
        channelId: 'channel-1',
        messageId: 'message-2',
        senderName: 'Jane',
        emoji: '👍',
        channelTopic: 'Support',
      },
      audience_rules: [],
      dedupe_key: null,
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:25:00.000Z',
      updated_at: '2026-03-03T12:25:00.000Z',
    });

    expect(dmReaction.headline.primary).toBe('Jane reacted 👍 to your direct message');
    expect(channelReaction.headline.primary).toBe('Jane reacted 👍 to your message in');
  });

  it('renders class cancellation activities as important class updates', () => {
    const definition = getActivityEventDefinition('class.session.canceled');
    if (!definition) {
      throw new Error('Missing class.session.canceled definition');
    }

    const rendered = definition.render({
      id: 'event-cancel-1',
      org_id: 'org-1',
      event_type: 'class.session.canceled',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        learningSpaceTitle: 'Algebra I',
        orgSlug: 'iconic-academy',
      },
      audience_rules: [],
      dedupe_key: 'session.canceled:exception-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(definition.importance).toBe('important');
    expect(rendered.headline.primary).toBe('Class session canceled');
    expect(rendered.actionButton).toEqual({
      label: 'Open class',
      variant: 'outline',
      href: '/iconic-academy/s/channel-1',
    });
  });

  it('does not expose removed payment reminder definitions', () => {
    expect(getActivityEventDefinition('legacy.payment.removed')).toBeUndefined();
    expect(getActivityEventDefinition('legacy.payments.removed')).toBeUndefined();
  });
});
