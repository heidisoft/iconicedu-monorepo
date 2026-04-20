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
      'payment.reminder.sent',
      'payments.reminder.sent',
      'reaction.added',
      'session.feedback_request.sent',
      'session.reminder.sent',
      'sessions.feedback_request.sent',
      'sessions.reminder.sent',
    ]);

    expect(getActivityEventDefinition('class.created')).toBeUndefined();
    expect(getActivityEventDefinition('member.removed')).toBeUndefined();
    expect(getActivityEventDefinition('session.started')).toBeUndefined();
    expect(getActivityEventDefinition('file.uploaded')).toBeUndefined();
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

  it('does not group mentioned channel messages into hourly message parents', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition?.group) {
      throw new Error('Missing message.posted grouping');
    }

    const key = definition.group.buildGroupKey({
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

    expect(key).toBeNull();
  });

  it('groups reactions under the matching dm/message hourly parent key', () => {
    const definition = getActivityEventDefinition('reaction.added');
    if (!definition?.group) {
      throw new Error('Missing reaction.added grouping');
    }

    const dmKey = definition.group.buildGroupKey({
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

    const channelKey = definition.group.buildGroupKey({
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

    expect(dmKey).toBe('dm-posted:channel-dm-1:2026-03-03T12');
    expect(channelKey).toBe('message-posted:channel-1:2026-03-03T12');
  });

  it('renders class cancellation activities as important class updates', () => {
    const definition = getActivityEventDefinition('class.session.canceled');
    if (!definition?.group) {
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

    const key = definition.group.buildGroupKey({
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
      },
      audience_rules: [],
      dedupe_key: 'session.canceled:exception-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(definition.importance).toBe('important');
    expect(key).toBe('class-updated:space-1:2026-03-03');
    expect(rendered.headline.primary).toBe('Class session canceled');
    expect(rendered.actionButton).toEqual({
      label: 'Open class',
      variant: 'outline',
      href: '/iconic-academy/s/channel-1',
    });
  });

  it('renders payment reminder activities with the payment CTA', () => {
    const definition = getActivityEventDefinition('payment.reminder.sent');
    if (!definition) {
      throw new Error('Missing payment.reminder.sent definition');
    }

    const rendered = definition.render({
      id: 'event-payment-1',
      org_id: 'org-1',
      event_type: 'payment.reminder.sent',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'system',
      actor_profile_id: null,
      scope: { kind: 'global' },
      object_ref: null,
      target_ref: null,
      payload: {
        title: 'Invoice overdue',
        summary: 'Please pay by March 10.',
        href: '/iconic-academy/billing/invoice-1',
      },
      audience_rules: [],
      dedupe_key: 'payment.reminder.sent:invoice-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Payment reminder');
    expect(rendered.headline.secondary).toBe('Invoice overdue');
    expect(rendered.actionButton).toEqual({
      label: 'View payment',
      variant: 'default',
      href: '/iconic-academy/billing/invoice-1',
    });
  });
});
