import { describe, expect, it } from 'vitest';

import { getActivityEventDefinition } from '@iconicedu/web/lib/activity-feed/definitions/activity-definitions';

function isoFromNow(offsetMinutes: number) {
  return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
}

describe('activity event definitions', () => {
  it('renders direct message activity headline with a linked conversation context and no action button', () => {
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
    expect(rendered.headline.secondaryHref).toBe('/iconic-academy/dm/channel-dm-1');
    expect(rendered.actionButton).toBeUndefined();
  });

  it('groups direct messages by channel and hour', () => {
    const definition = getActivityEventDefinition('dm.posted');
    if (!definition || !definition.group) {
      throw new Error('Missing dm.posted grouping');
    }

    const key = definition.group.buildGroupKey({
      id: 'event-dm-2',
      org_id: 'org-1',
      event_type: 'dm.posted',
      occurred_at: '2026-03-03T12:45:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-dm-1' },
      object_ref: { kind: 'message', id: 'message-2' },
      target_ref: null,
      payload: {
        channelId: 'channel-dm-1',
        messageId: 'message-2',
        senderName: 'Jane',
        content: 'Second message',
        channelRouteKind: 'dm',
      },
      audience_rules: [],
      dedupe_key: 'dm.posted:message-2',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:45:00.000Z',
      updated_at: '2026-03-03T12:45:00.000Z',
    });

    expect(key).toBe('dm-posted:channel-dm-1:2026-03-03T12');
  });

  it('renders direct message reaction added activity', () => {
    const definition = getActivityEventDefinition('dm.reaction.added');
    if (!definition) {
      throw new Error('Missing dm.reaction.added definition');
    }

    const rendered = definition.render({
      id: 'event-dm-reaction-1',
      org_id: 'org-1',
      event_type: 'dm.reaction.added',
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
        emoji: '👍',
        channelRouteKind: 'dm',
      },
      audience_rules: [],
      dedupe_key: null,
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Jane reacted 👍 to your direct message');
    expect(rendered.actionButton).toBeUndefined();
  });

  it('groups direct message reactions into the dm posted hourly group key', () => {
    const definition = getActivityEventDefinition('dm.reaction.added');
    if (!definition || !definition.group) {
      throw new Error('Missing dm.reaction.added grouping');
    }

    const key = definition.group.buildGroupKey({
      id: 'event-dm-reaction-2',
      org_id: 'org-1',
      event_type: 'dm.reaction.added',
      occurred_at: '2026-03-03T12:25:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-dm-1' },
      object_ref: { kind: 'message', id: 'message-2' },
      target_ref: null,
      payload: {
        channelId: 'channel-dm-1',
        messageId: 'message-2',
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

    expect(key).toBe('dm-posted:channel-dm-1:2026-03-03T12');
  });

  it('renders channel reaction added activity', () => {
    const definition = getActivityEventDefinition('reaction.added');
    if (!definition) {
      throw new Error('Missing reaction.added definition');
    }

    const rendered = definition.render({
      id: 'event-channel-reaction-1',
      org_id: 'org-1',
      event_type: 'reaction.added',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'user', userId: 'profile-2' },
      object_ref: { kind: 'message', id: 'message-1' },
      target_ref: null,
      payload: {
        channelId: 'channel-1',
        messageId: 'message-1',
        senderName: 'Jane',
        emoji: '👍',
        channelTopic: 'Support',
        orgSlug: 'iconic-academy',
      },
      audience_rules: [],
      dedupe_key: null,
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Jane reacted 👍 to your message in');
    expect(rendered.actionButton).toEqual({
      label: 'View messages',
      variant: 'outline',
      href: '/iconic-academy/c/channel-1',
    });
  });

  it('groups channel reactions into the channel message hourly group key', () => {
    const definition = getActivityEventDefinition('reaction.added');
    if (!definition || !definition.group) {
      throw new Error('Missing reaction.added grouping');
    }

    const key = definition.group.buildGroupKey({
      id: 'event-channel-reaction-2',
      org_id: 'org-1',
      event_type: 'reaction.added',
      occurred_at: '2026-03-03T12:25:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'user', userId: 'profile-2' },
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

    expect(key).toBe('message-posted:channel-1:2026-03-03T12');
  });

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
        channelTopic: 'Support',
        orgSlug: 'iconic-academy',
      },
      audience_rules: [],
      dedupe_key: 'message.posted:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Jane sent you a message in');
    expect(rendered.actionButton).toEqual({
      label: 'View messages',
      variant: 'outline',
      href: '/iconic-academy/c/channel-1',
    });
  });

  it('groups posted channel messages by channel and hour', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition || !definition.group) {
      throw new Error('Missing message.posted grouping');
    }

    const key = definition.group.buildGroupKey({
      id: 'event-message-2',
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
        content: 'Second message',
        channelTopic: 'Support',
      },
      audience_rules: [],
      dedupe_key: 'message.posted:message-2',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:45:00.000Z',
      updated_at: '2026-03-03T12:45:00.000Z',
    });

    expect(key).toBe('message-posted:channel-1:2026-03-03T12');
  });

  it('does not group channel mentions into hourly channel message parents', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition || !definition.group) {
      throw new Error('Missing message.posted grouping');
    }

    const key = definition.group.buildGroupKey({
      id: 'event-message-mention-1',
      org_id: 'org-1',
      event_type: 'message.posted',
      occurred_at: '2026-03-03T12:45:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'user', userId: 'profile-2' },
      object_ref: { kind: 'message', id: 'message-2' },
      target_ref: null,
      payload: {
        channelId: 'channel-1',
        messageId: 'message-2',
        senderName: 'Jane',
        content: 'Second message',
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

  it('renders mentions with the updated headline copy', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition) {
      throw new Error('Missing message.posted definition');
    }

    const rendered = definition.render({
      id: 'event-message-mention-render-1',
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

    expect(rendered.headline.primary).toBe('Jane mentioned you in');
    expect(rendered.headline.secondary).toBe('Support');
  });

  it('groups channel thread replies into hourly channel message parents', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition || !definition.group) {
      throw new Error('Missing message.posted grouping');
    }

    const key = definition.group.buildGroupKey({
      id: 'event-message-thread-1',
      org_id: 'org-1',
      event_type: 'message.posted',
      occurred_at: '2026-03-03T12:45:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: { kind: 'message', id: 'message-3' },
      target_ref: null,
      payload: {
        channelId: 'channel-1',
        messageId: 'message-3',
        senderName: 'Jane',
        content: 'Thread reply',
        channelTopic: 'Support',
        threadReply: true,
      },
      audience_rules: [],
      dedupe_key: 'message.posted:message-3',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:45:00.000Z',
      updated_at: '2026-03-03T12:45:00.000Z',
    });

    expect(key).toBe('message-posted:channel-1:2026-03-03T12');
  });

  it('renders channel thread replies with the standard message headline', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition) {
      throw new Error('Missing message.posted definition');
    }

    const rendered = definition.render({
      id: 'event-thread-reply-1',
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
        content: 'Replying in thread',
        channelTopic: 'Support',
        threadReply: true,
        orgSlug: 'iconic-academy',
      },
      audience_rules: [],
      dedupe_key: 'message.posted:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Jane sent you a message in');
    expect(rendered.actionButton).toEqual({
      label: 'View messages',
      variant: 'outline',
      href: '/iconic-academy/c/channel-1',
    });
  });

  it('renders dm-routed thread replies with the standard direct-message headline', () => {
    const definition = getActivityEventDefinition('message.posted');
    if (!definition) {
      throw new Error('Missing message.posted definition');
    }

    const rendered = definition.render({
      id: 'event-thread-reply-dm-1',
      org_id: 'org-1',
      event_type: 'message.posted',
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
        content: 'Replying in dm thread',
        channelTopic: 'Priya + Riley',
        channelRouteKind: 'dm',
        threadReply: true,
      },
      audience_rules: [],
      dedupe_key: 'message.posted:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Jane sent you a direct message in');
  });

  it('routes class-scoped message activities to the class page', () => {
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

  it('renders member invited as a single-line learning-space invite with no button', () => {
    const definition = getActivityEventDefinition('member.invited');
    if (!definition) {
      throw new Error('Missing member.invited definition');
    }

    const rendered = definition.render({
      id: 'event-member-invited-1',
      org_id: 'org-1',
      event_type: 'member.invited',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        memberDisplayName: 'Tehara Morgan',
        memberProfileId: 'tehara-profile-id',
      },
      audience_rules: [],
      dedupe_key: 'member.invited:space-1:tehara',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline).toEqual({
      primary: 'Tehara Morgan added',
    });
    expect(rendered.leading).toEqual({
      kind: 'avatars',
      avatars: [
        {
          name: 'Tehara Morgan',
          avatar: { source: 'seed', seed: 'tehara-profile-id' },
          themeKey: null,
        },
      ],
      overflowCount: 0,
    });
    expect(rendered.summary).toBe('Added: Tehara Morgan. Added to Class.');
    expect(rendered.actionButton).toBeUndefined();
  });

  it('renders member removed matching invite style with removed member avatar', () => {
    const definition = getActivityEventDefinition('member.removed');
    if (!definition) {
      throw new Error('Missing member.removed definition');
    }

    const rendered = definition.render({
      id: 'event-member-removed-1',
      org_id: 'org-1',
      event_type: 'member.removed',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math Foundations',
        memberDisplayName: 'Tehara Morgan',
        memberProfileId: 'tehara-profile-id',
        memberAvatarUrl: 'https://cdn.test/tehara.png',
        memberThemeKey: 'rose',
      },
      audience_rules: [],
      dedupe_key: 'member.removed:space-1:tehara',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline).toEqual({
      primary: 'Tehara Morgan removed',
    });
    expect(rendered.leading).toEqual({
      kind: 'avatars',
      avatars: [
        {
          name: 'Tehara Morgan',
          avatar: { source: 'upload', url: 'https://cdn.test/tehara.png' },
          themeKey: 'rose',
        },
      ],
      overflowCount: 0,
    });
    expect(rendered.summary).toBe(
      'Removed: Tehara Morgan. Removed from Math Foundations.',
    );
    expect(rendered.actionButton).toBeUndefined();
  });

  it('renders members removed with plural verb and summary', () => {
    const definition = getActivityEventDefinition('members.removed');
    if (!definition) {
      throw new Error('Missing members.removed definition');
    }

    const rendered = definition.render({
      id: 'event-members-removed-1',
      org_id: 'org-1',
      event_type: 'members.removed',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math Foundations',
        memberCount: 2,
        members: [
          { profileId: 'p-1', displayName: 'Tehara Morgan' },
          { profileId: 'p-2', displayName: 'Riley Morgan' },
        ],
      },
      audience_rules: [],
      dedupe_key: 'members.removed:space-1:batch',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.verb).toBe('members.removed');
    expect(rendered.headline).toEqual({
      primary: '2 participants removed',
    });
    expect(rendered.summary).toBe(
      'Removed: Tehara Morgan, Riley Morgan. Removed from Math Foundations.',
    );
  });

  it('renders grouped member invite with one summary listing added members', () => {
    const definition = getActivityEventDefinition('members.invited');
    if (!definition) {
      throw new Error('Missing members.invited definition');
    }

    const rendered = definition.render({
      id: 'event-member-invited-2',
      org_id: 'org-1',
      event_type: 'members.invited',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math Foundations',
        memberCount: 3,
        members: [
          { profileId: 'p-1', displayName: 'Tehara Morgan' },
          { profileId: 'p-2', displayName: 'Riley Morgan' },
          { profileId: 'p-3', displayName: 'Alex Stone' },
        ],
      },
      audience_rules: [],
      dedupe_key: 'members.invited:space-1:batch',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline).toEqual({
      primary: '3 participants added',
    });
    expect(rendered.summary).toBe(
      'Added: Tehara Morgan, Riley Morgan, Alex Stone. Added to Math Foundations.',
    );
  });

  it('renders class created leaf items as simple summaries without action buttons', () => {
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
        firstSessionStartAt: '2026-03-07T22:00:00.000Z',
        firstSessionTimezone: 'America/Los_Angeles',
      },
      audience_rules: [],
      dedupe_key: 'class.created:space-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline).toEqual({
      primary: 'Class created',
      secondary: 'Algebra I',
    });
    expect(rendered.summary).toBe('First session Mar 7 at 2:00 PM.');
    expect(rendered.leading).toEqual({
      kind: 'avatars',
      avatars: [
        {
          name: 'System',
          avatar: { source: 'seed', seed: 'system' },
          themeKey: null,
        },
      ],
      overflowCount: 0,
    });
    expect(rendered.actionButton).toBeUndefined();
  });

  it('renders class updated with class wording and participant avatar pattern', () => {
    const definition = getActivityEventDefinition('class.updated');
    if (!definition || !definition.group) {
      throw new Error('Missing class.updated definition');
    }

    const event = {
      id: 'event-2b',
      org_id: 'org-1',
      event_type: 'class.updated',
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
        changeSummary: 'Schedule changed for next week.',
        invitedMembers: [
          {
            profileId: 'student-1',
            name: 'Tehara Morgan',
            avatarUrl: 'https://cdn.test/tehara.png',
            themeKey: 'rose',
          },
          {
            profileId: 'guardian-1',
            name: 'Riley Morgan',
            themeKey: 'emerald',
          },
        ],
      },
      audience_rules: [],
      dedupe_key: 'class.updated:space-1:1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    };

    const rendered = definition.render(event);
    const grouped = definition.group.renderGroup?.(event);

    expect(rendered.headline).toEqual({
      primary: 'Class updated',
      secondary: 'Algebra I',
    });
    expect(rendered.leading).toEqual({
      kind: 'avatars',
      avatars: [
        {
          name: 'System',
          avatar: { source: 'seed', seed: 'system' },
          themeKey: null,
        },
      ],
      overflowCount: 0,
    });
    expect(rendered.summary).toBe('Schedule changed for next week.');
    expect(rendered.actionButton).toBeUndefined();
    expect(grouped?.headline.primary).toBe('Class updated');
    expect(grouped?.actionButton).toMatchObject({
      label: 'Open classroom chat',
      href: '../spaces/channel-1',
    });
    expect(grouped?.leading).toEqual({
      kind: 'avatars',
      avatars: [
        {
          name: 'Tehara Morgan',
          avatar: { source: 'upload', url: 'https://cdn.test/tehara.png' },
          themeKey: 'rose',
        },
        {
          name: 'Riley Morgan',
          avatar: { source: 'seed', seed: 'guardian-1' },
          themeKey: 'emerald',
        },
      ],
      overflowCount: 0,
    });
  });

  it('keeps full participant avatars in group payload and sets overflow count for more than 3', () => {
    const definition = getActivityEventDefinition('class.updated');
    if (!definition?.group) {
      throw new Error('Missing class.updated group definition');
    }

    const grouped = definition.group.renderGroup?.({
      id: 'event-2c',
      org_id: 'org-1',
      event_type: 'class.updated',
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
        invitedMembers: [
          { profileId: 'p-1', name: 'Ava One' },
          { profileId: 'p-2', name: 'Ben Two' },
          { profileId: 'p-3', name: 'Cia Three' },
          { profileId: 'p-4', name: 'Dan Four' },
        ],
      },
      audience_rules: [],
      dedupe_key: 'class.updated:space-1:overflow',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(grouped?.leading).toEqual({
      kind: 'avatars',
      avatars: [
        { name: 'Ava One', avatar: { source: 'seed', seed: 'p-1' }, themeKey: null },
        { name: 'Ben Two', avatar: { source: 'seed', seed: 'p-2' }, themeKey: null },
        { name: 'Cia Three', avatar: { source: 'seed', seed: 'p-3' }, themeKey: null },
        { name: 'Dan Four', avatar: { source: 'seed', seed: 'p-4' }, themeKey: null },
      ],
      overflowCount: 1,
    });
  });

  it('groups class setup activities under class-created by default', () => {
    const classCreated = getActivityEventDefinition('class.created');
    const memberInvited = getActivityEventDefinition('member.invited');
    const sessionScheduled = getActivityEventDefinition('class.session.scheduled');

    if (!classCreated?.group || !memberInvited?.group || !sessionScheduled?.group) {
      throw new Error('Missing class setup group definitions');
    }

    const event = {
      id: 'event-setup',
      org_id: 'org-1',
      event_type: 'class.created',
      occurred_at: '2026-03-03T12:34:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        learningSpaceTitle: 'Algebra I',
        channelId: 'channel-1',
      },
      audience_rules: [],
      dedupe_key: null,
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:34:00.000Z',
      updated_at: '2026-03-03T12:34:00.000Z',
    };

    const classKey = classCreated.group.buildGroupKey(event);
    const memberKey = memberInvited.group.buildGroupKey({
      ...event,
      event_type: 'member.invited',
    });
    const sessionKey = sessionScheduled.group.buildGroupKey({
      ...event,
      event_type: 'class.session.scheduled',
    });

    expect(classKey).toBe('class-created:space-1');
    expect(memberKey).toBe(classKey);
    expect(sessionKey).toBe(classKey);
    expect(
      classCreated.group.renderGroup?.({
        ...event,
        payload: {
          ...event.payload,
          invitedMembers: [
            { profileId: 'profile-1', name: 'Tehara Morgan' },
            { profileId: 'profile-2', name: 'Riley Morgan' },
          ],
        },
      }),
    ).toMatchObject({
      headline: { primary: 'Class created' },
      leading: {
        kind: 'avatars',
      },
    });
  });

  it('groups update-phase class activities under class-updated weekly buckets', () => {
    const memberInvited = getActivityEventDefinition('member.invited');
    const memberRemoved = getActivityEventDefinition('member.removed');
    const sessionScheduled = getActivityEventDefinition('class.session.scheduled');
    const sessionCanceled = getActivityEventDefinition('class.session.canceled');
    const sessionsScheduled = getActivityEventDefinition('class.sessions.scheduled');
    const sessionsRescheduled = getActivityEventDefinition('class.sessions.rescheduled');
    const sessionsCanceled = getActivityEventDefinition('class.sessions.canceled');
    const classUpdated = getActivityEventDefinition('class.updated');

    if (
      !memberInvited?.group ||
      !memberRemoved?.group ||
      !sessionScheduled?.group ||
      !sessionCanceled?.group ||
      !sessionsScheduled?.group ||
      !sessionsRescheduled?.group ||
      !sessionsCanceled?.group ||
      !classUpdated?.group
    ) {
      throw new Error('Missing update group definitions');
    }

    const event = {
      id: 'event-update',
      org_id: 'org-1',
      event_type: 'class.updated',
      occurred_at: '2026-03-06T12:34:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        learningSpaceTitle: 'Algebra I',
        channelId: 'channel-1',
        activityPhase: 'updated',
      },
      audience_rules: [],
      dedupe_key: null,
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-06T12:34:00.000Z',
      updated_at: '2026-03-06T12:34:00.000Z',
    };

    const classUpdatedKey = classUpdated.group.buildGroupKey(event);
    const memberKey = memberInvited.group.buildGroupKey({
      ...event,
      event_type: 'member.invited',
    });
    const memberRemovedKey = memberRemoved.group.buildGroupKey({
      ...event,
      event_type: 'member.removed',
    });
    const sessionScheduledKey = sessionScheduled.group.buildGroupKey({
      ...event,
      event_type: 'class.session.scheduled',
    });
    const sessionCanceledKey = sessionCanceled.group.buildGroupKey({
      ...event,
      event_type: 'class.session.canceled',
    });
    const sessionsScheduledKey = sessionsScheduled.group.buildGroupKey({
      ...event,
      event_type: 'class.sessions.scheduled',
    });
    const sessionsRescheduledKey = sessionsRescheduled.group.buildGroupKey({
      ...event,
      event_type: 'class.sessions.rescheduled',
    });
    const sessionsCanceledKey = sessionsCanceled.group.buildGroupKey({
      ...event,
      event_type: 'class.sessions.canceled',
    });

    expect(classUpdatedKey).toBe('class-updated:space-1:2026-03-06');
    expect(memberKey).toBe(classUpdatedKey);
    expect(memberRemovedKey).toBe(classUpdatedKey);
    expect(sessionScheduledKey).toBe(classUpdatedKey);
    expect(sessionCanceledKey).toBe(classUpdatedKey);
    expect(sessionsScheduledKey).toBe(classUpdatedKey);
    expect(sessionsRescheduledKey).toBe(classUpdatedKey);
    expect(sessionsCanceledKey).toBe(classUpdatedKey);

    const nextDayKey = classUpdated.group.buildGroupKey({
      ...event,
      occurred_at: '2026-03-07T01:10:00.000Z',
      created_at: '2026-03-07T01:10:00.000Z',
      updated_at: '2026-03-07T01:10:00.000Z',
    });
    expect(nextDayKey).toBe('class-updated:space-1:2026-03-07');
    expect(nextDayKey).not.toBe(classUpdatedKey);
  });

  it('groups class file uploads into the hourly channel conversation bucket', () => {
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

    expect(definition.group.buildGroupKey(event)).toBe(
      'message-posted:channel-1:2026-03-03T12',
    );
    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: 'New class files',
        secondary: 'Algebra I',
      },
    });
  });

  it('renders session scheduled summary and schedule-tab action', () => {
    const definition = getActivityEventDefinition('class.session.scheduled');
    if (!definition) {
      throw new Error('Missing class.session.scheduled definition');
    }

    const rendered = definition.render({
      id: 'event-session-scheduled-1',
      org_id: 'org-1',
      event_type: 'class.session.scheduled',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math Foundations',
        startAt: '2026-03-07T22:00:00.000Z',
        timezone: 'America/Los_Angeles',
      },
      audience_rules: [],
      dedupe_key: 'class.session.scheduled:space-1:2026-03-07',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.summary).toBe(
      'First session: Sat 2:00 PM PST, then weekly 2:00 PM PST',
    );
    expect(rendered.leading).toEqual({
      kind: 'icon',
      iconKey: 'CalendarDays',
      tone: 'info',
    });
    expect(rendered.actionButton).toEqual({
      label: 'View schedule',
      variant: 'outline',
      href: '../spaces/channel-1?tab=schedule',
    });
  });

  it('renders update-phase session scheduled as Session scheduled [DATE TIME]', () => {
    const definition = getActivityEventDefinition('class.session.scheduled');
    if (!definition) {
      throw new Error('Missing class.session.scheduled definition');
    }

    const rendered = definition.render({
      id: 'event-session-scheduled-updated-1',
      org_id: 'org-1',
      event_type: 'class.session.scheduled',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'system-profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math Foundations',
        activityPhase: 'updated',
        startAt: '2026-03-07T22:00:00.000Z',
        timezone: 'America/Los_Angeles',
      },
      audience_rules: [],
      dedupe_key: 'class.session.scheduled:space-1:2026-03-07',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Class session scheduled');
    expect(rendered.summary).toBe('Session scheduled Mar 7 at 2:00 PM.');
  });

  it('renders rescheduled and cancelled sessions with class-session copy for overrides and exceptions', () => {
    const rescheduled = getActivityEventDefinition('class.session.rescheduled');
    const canceled = getActivityEventDefinition('class.session.canceled');
    if (!rescheduled || !canceled) {
      throw new Error('Missing session schedule change definitions');
    }

    const rescheduledRendered = rescheduled.render({
      id: 'event-session-rescheduled-1',
      org_id: 'org-1',
      event_type: 'class.session.rescheduled',
      occurred_at: '2026-03-08T12:00:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'system-profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math Foundations',
        firstSessionStartAt: '2026-03-15T21:30:00.000Z',
        firstSessionTimezone: 'America/Los_Angeles',
        rescheduledFromStartAt: '2026-03-08T22:00:00.000Z',
        rescheduledToStartAt: '2026-03-15T21:30:00.000Z',
      },
      audience_rules: [],
      dedupe_key: 'class.session.rescheduled:space-1:1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-08T12:00:00.000Z',
      updated_at: '2026-03-08T12:00:00.000Z',
    });
    expect(rescheduledRendered.headline.primary).toBe('Class session rescheduled');
    expect(rescheduledRendered.headline.secondary).toBe('Math Foundations');
    expect(rescheduledRendered.summary).toBe(
      'Session: Math Foundations weekly session moved from Sun, Mar 8, 3:00 PM PT to Sun, Mar 15, 2:30 PM PT',
    );
    expect(rescheduledRendered.leading).toEqual({
      kind: 'icon',
      iconKey: 'CalendarCheck',
      tone: 'info',
    });
    expect(rescheduledRendered.actionButton).toBeUndefined();

    const canceledRendered = canceled.render({
      id: 'event-session-canceled-1',
      org_id: 'org-1',
      event_type: 'class.session.canceled',
      occurred_at: '2026-03-08T12:00:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'system-profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math Foundations',
        firstSessionStartAt: '2026-03-22T21:30:00.000Z',
        firstSessionTimezone: 'America/Los_Angeles',
        canceledStartAt: '2026-03-15T21:30:00.000Z',
        canceledReason: 'Holiday',
      },
      audience_rules: [],
      dedupe_key: 'class.session.canceled:space-1:1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-08T12:00:00.000Z',
      updated_at: '2026-03-08T12:00:00.000Z',
    });
    expect(canceledRendered.headline.primary).toBe('Class session cancelled');
    expect(canceledRendered.headline.secondary).toBe('Math Foundations');
    expect(canceledRendered.summary).toBe(
      'Session: Math Foundations weekly session (Sun, Mar 15 2:30 PM PT) canceled due to Holiday',
    );
    expect(canceledRendered.leading).toEqual({
      kind: 'icon',
      iconKey: 'CalendarX',
      tone: 'warning',
    });
    expect(canceledRendered.actionButton).toBeUndefined();
  });

  it('defines plural class session schedule activity events', () => {
    expect(getActivityEventDefinition('class.sessions.scheduled')).toBeDefined();
    expect(getActivityEventDefinition('class.sessions.rescheduled')).toBeDefined();
    expect(getActivityEventDefinition('class.sessions.canceled')).toBeDefined();
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

  it('groups session timeline activities by session anchor', () => {
    const definition = getActivityEventDefinition('session.reminder.sent');
    const sessionStarted = getActivityEventDefinition('session.started');
    const sessionEnded = getActivityEventDefinition('session.ended');
    if (!definition?.group) {
      throw new Error('Missing session.reminder.sent group definition');
    }
    if (!sessionStarted?.group || !sessionEnded?.group) {
      throw new Error('Missing session timeline group definitions');
    }

    const event = {
      id: 'event-6',
      org_id: 'org-1',
      event_type: 'session.reminder.sent',
      occurred_at: '2026-03-03T12:34:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-system',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-6' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-6',
        learningSpaceId: 'space-1',
        scheduleId: 'schedule-1',
        title: 'Algebra',
        occurrenceStart: '2026-03-03T12:40:00.000Z',
        reminderOffsetMinutes: 5,
        timezone: 'UTC',
        summary: 'Class starts in 10 minutes',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key: 'session.reminder:org-1:schedule-1:2026-03-03T12:40:00.000Z:activity',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:34:00.000Z',
      updated_at: '2026-03-03T12:34:00.000Z',
    };

    expect(definition.group.buildGroupKey(event)).toBe(
      'live-session:learning_space:space-1:schedule:schedule-1:2026-03-03T12:40',
    );
    expect(sessionStarted.group.buildGroupKey(event)).toBe(
      'live-session:learning_space:space-1:schedule:schedule-1:2026-03-03T12:40',
    );
    expect(sessionEnded.group.buildGroupKey(event)).toBe(
      'live-session:learning_space:space-1:schedule:schedule-1:2026-03-03T12:40',
    );
    const renderedReminder = definition.render(event);
    expect(renderedReminder).toMatchObject({
      headline: {
        primary: 'Your class session will start in 5 minutes',
      },
      summary: 'Your session for Algebra will start on Mar 3 at 12:40 PM',
      actionButton: {
        label: 'Join class',
        href: '../spaces/channel-1',
      },
      leading: {
        kind: 'icon',
        iconKey: 'Video',
        tone: 'info',
      },
    });
    expect(renderedReminder).not.toHaveProperty('expandedContent');

    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: 'Class session 2026-03-03T12:40:00.000Z',
        secondary: 'Algebra',
      },
      actionButton: {
        label: 'Join now',
        variant: 'default',
        href: '../spaces/channel-1',
      },
      metadata: {
        sessionGroupLocalTime: true,
      },
    });
  });

  it('renders non-scheduled live-session groups with a meaningful parent headline', () => {
    const definition = getActivityEventDefinition('session.started');
    if (!definition?.group) {
      throw new Error('Missing session.started group definition');
    }

    const startedAt = isoFromNow(-2);
    const event = {
      id: 'event-live-unscheduled-1',
      org_id: 'org-1',
      event_type: 'session.started',
      occurred_at: startedAt,
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: { kind: 'session', id: 'live-session-1' },
      target_ref: null,
      payload: {
        liveSessionId: 'live-session-1',
        channelId: 'channel-1',
        channelTopic: 'Parent Support Room',
        title: 'Parent Support Room',
        startedByDisplayName: 'Taylor Reed',
        mode: 'video',
      },
      audience_rules: [],
      dedupe_key: 'session.started:live-session-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: startedAt,
      updated_at: startedAt,
    };

    expect(definition.group.buildGroupKey(event)).toBe(
      `live-session:channel:channel-1:huddle-window:${startedAt.slice(0, 16)}`,
    );
    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: 'Taylor Reed started a video huddle',
      },
      actionButton: {
        label: 'Join now',
        variant: 'default',
        href: '../c/channel-1',
      },
    });
  });

  it('renders generic huddle parents for unscheduled audio sessions', () => {
    const definition = getActivityEventDefinition('session.started');
    if (!definition?.group) {
      throw new Error('Missing session.started group definition');
    }

    const startedAt = isoFromNow(-3);
    const event = {
      id: 'event-live-unscheduled-audio-1',
      org_id: 'org-1',
      event_type: 'session.started',
      occurred_at: startedAt,
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: { kind: 'session', id: 'live-session-2' },
      target_ref: null,
      payload: {
        liveSessionId: 'live-session-2',
        channelId: 'channel-1',
        channelTopic: 'Advisor Room',
        title: 'Advisor Room',
        startedByDisplayName: 'Taylor Reed',
        mode: 'audio',
      },
      audience_rules: [],
      dedupe_key: 'session.started:live-session-2',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: startedAt,
      updated_at: startedAt,
    };

    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: 'Taylor Reed started an audio huddle',
      },
      actionButton: {
        label: 'Join now',
        variant: 'default',
        href: '../c/channel-1',
      },
    });
  });

  it('does not create a separate dated group from startedAt for unscheduled live sessions', () => {
    const started = getActivityEventDefinition('session.started');
    const joined = getActivityEventDefinition('member.joined');
    if (!started?.group || !joined?.group) {
      throw new Error('Missing live-session grouping definitions');
    }

    const startedAt = isoFromNow(-2);
    const joinedAt = isoFromNow(-1);
    const startedEvent = {
      id: 'event-dm-session-started-1',
      org_id: 'org-1',
      event_type: 'session.started',
      occurred_at: startedAt,
      source_kind: 'profile' as const,
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel' as const, channelId: 'channel-dm-1' },
      object_ref: { kind: 'session' as const, id: 'live-session-dm-1' },
      target_ref: null,
      payload: {
        liveSessionId: 'live-session-dm-1',
        channelId: 'channel-dm-1',
        title: 'Direct message',
        channelTopic: 'Direct message',
        mode: 'video',
        startedByDisplayName: 'Tiffany T',
        startedAt,
      },
      audience_rules: [],
      dedupe_key: 'session.started:live-session-dm-1',
      projection_status: 'pending' as const,
      projection_attempts: 0,
      created_at: startedAt,
      updated_at: startedAt,
    };

    const joinedEvent = {
      ...startedEvent,
      id: 'event-dm-member-joined-1',
      event_type: 'member.joined',
      payload: {
        liveSessionId: 'live-session-dm-1',
        channelId: 'channel-dm-1',
        title: 'Direct message',
        channelTopic: 'Direct message',
        mode: 'video',
        memberProfileId: 'profile-2',
        memberDisplayName: 'Tiffany T',
        joinedAt,
      },
      dedupe_key: 'member.joined:live-session-dm-1:profile-2',
    };

    expect(started.group.buildGroupKey(startedEvent)).toBe(
      `live-session:channel:channel-dm-1:huddle-window:${startedAt.slice(0, 16)}`,
    );
    expect(joined.group.buildGroupKey(joinedEvent)).toBe(
      `live-session:channel:channel-dm-1:huddle-window:${startedAt.slice(0, 16)}`,
    );
    expect(started.render(startedEvent)).toMatchObject({
      headline: { primary: 'Tiffany T started a video huddle' },
      actionButton: {
        label: 'Join now',
        variant: 'default',
        href: '../c/channel-dm-1',
      },
    });
  });

  it('creates a new non-learning-space huddle key when a later start is more than one hour away', () => {
    const started = getActivityEventDefinition('session.started');
    if (!started?.group) {
      throw new Error('Missing session.started group definition');
    }

    const earlyEvent = {
      id: 'event-dm-session-started-early',
      org_id: 'org-1',
      event_type: 'session.started',
      occurred_at: '2026-03-19T19:00:00.000Z',
      source_kind: 'profile' as const,
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel' as const, channelId: 'channel-dm-1' },
      object_ref: { kind: 'session' as const, id: 'live-session-dm-early' },
      target_ref: null,
      payload: {
        liveSessionId: 'live-session-dm-early',
        channelId: 'channel-dm-1',
        title: 'Direct message',
        channelTopic: 'Direct message',
        mode: 'video',
      },
      audience_rules: [],
      dedupe_key: 'session.started:live-session-dm-early',
      projection_status: 'pending' as const,
      projection_attempts: 0,
      created_at: '2026-03-19T19:00:00.000Z',
      updated_at: '2026-03-19T19:00:00.000Z',
    };

    const laterEvent = {
      ...earlyEvent,
      id: 'event-dm-session-started-late',
      occurred_at: '2026-03-19T20:05:00.000Z',
      payload: {
        ...earlyEvent.payload,
        liveSessionId: 'live-session-dm-late',
      },
      dedupe_key: 'session.started:live-session-dm-late',
      created_at: '2026-03-19T20:05:00.000Z',
      updated_at: '2026-03-19T20:05:00.000Z',
    };

    expect(started.group.buildGroupKey(earlyEvent)).toBe(
      'live-session:channel:channel-dm-1:huddle-window:2026-03-19T19:00',
    );
    expect(started.group.buildGroupKey(laterEvent)).toBe(
      'live-session:channel:channel-dm-1:huddle-window:2026-03-19T20:05',
    );
  });

  it('keeps session.started and member.joined in the same scheduled session group', () => {
    const started = getActivityEventDefinition('session.started');
    const joined = getActivityEventDefinition('member.joined');
    if (!started?.group || !joined?.group) {
      throw new Error('Missing live-session grouping definitions');
    }

    const basePayload = {
      liveSessionId: 'live-session-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      scheduleId: 'schedule-1',
      title: 'ELA with Mr Daniel',
      occurrenceStart: '2026-03-19T16:57:00.000Z',
      occurrenceLabel: 'Mar 19 at 12:57 PM EDT',
      isScheduledSessionWindow: true,
      mode: 'video',
    };

    const startedEvent = {
      id: 'event-session-started-1',
      org_id: 'org-1',
      event_type: 'session.started',
      occurred_at: '2026-03-19T16:57:00.000Z',
      source_kind: 'profile' as const,
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space' as const, learningSpaceId: 'space-1' },
      object_ref: { kind: 'session' as const, id: 'live-session-1' },
      target_ref: { kind: 'learning_space' as const, id: 'space-1' },
      payload: {
        ...basePayload,
        startedByDisplayName: 'Daniel W',
      },
      audience_rules: [],
      dedupe_key: 'session.started:live-session-1',
      projection_status: 'pending' as const,
      projection_attempts: 0,
      created_at: '2026-03-19T16:57:00.000Z',
      updated_at: '2026-03-19T16:57:00.000Z',
    };

    const joinedEvent = {
      ...startedEvent,
      id: 'event-member-joined-1',
      event_type: 'member.joined',
      payload: {
        ...basePayload,
        memberProfileId: 'profile-2',
        memberDisplayName: 'Daniel W',
        joinedAt: '2026-03-19T16:57:30.000Z',
      },
      dedupe_key: 'member.joined:live-session-1:profile-2',
    };

    expect(started.group.buildGroupKey(startedEvent)).toBe(
      'live-session:learning_space:space-1:schedule:schedule-1:2026-03-19T16:57',
    );
    expect(joined.group.buildGroupKey(joinedEvent)).toBe(
      'live-session:learning_space:space-1:schedule:schedule-1:2026-03-19T16:57',
    );
  });

  it('renders scheduled session.started groups with class-session parent semantics', () => {
    const definition = getActivityEventDefinition('session.started');
    if (!definition?.group) {
      throw new Error('Missing session.started group definition');
    }

    const occurrenceStart = isoFromNow(-10);
    const occurrenceEndAt = isoFromNow(50);
    const event = {
      id: 'event-space-session-started-1',
      org_id: 'org-1',
      event_type: 'session.started',
      occurred_at: occurrenceStart,
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'session', id: 'live-session-1' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        liveSessionId: 'live-session-1',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'ELA with Mr Daniel',
        occurrenceStart,
        occurrenceEndAt,
        isScheduledSessionWindow: true,
        startedByDisplayName: 'Daniel W',
        mode: 'video',
      },
      audience_rules: [],
      dedupe_key: 'session.started:live-session-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: occurrenceStart,
      updated_at: occurrenceStart,
    };

    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: `Class session ${occurrenceStart}`,
        secondary: 'ELA with Mr Daniel',
      },
      actionButton: {
        label: 'Join now',
        variant: 'default',
        href: '../spaces/channel-1',
      },
    });
  });

  it('renders learning-space outside-schedule parents as huddles', () => {
    const definition = getActivityEventDefinition('session.started');
    if (!definition?.group) {
      throw new Error('Missing session.started group definition');
    }

    const startedAt = isoFromNow(-1);
    const event = {
      id: 'event-space-session-started-outside-1',
      org_id: 'org-1',
      event_type: 'session.started',
      occurred_at: startedAt,
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'session', id: 'live-session-3' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        liveSessionId: 'live-session-3',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'ELA with Mr Daniel',
        startedByDisplayName: 'Daniel W',
        mode: 'audio',
        isScheduledSessionWindow: false,
      },
      audience_rules: [],
      dedupe_key: 'session.started:live-session-3',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: startedAt,
      updated_at: startedAt,
    };

    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: 'Daniel W started an audio huddle',
      },
      actionButton: {
        label: 'Join now',
        variant: 'default',
        href: '../spaces/channel-1',
      },
    });
  });

  it('hides Join now for stale class-started and stale huddle activity', () => {
    const definition = getActivityEventDefinition('session.started');
    if (!definition?.group) {
      throw new Error('Missing session.started group definition');
    }

    const staleScheduledStart = isoFromNow(-120);
    const staleHuddleStart = isoFromNow(-30);

    const staleScheduledEvent = {
      id: 'event-session-started-stale-scheduled',
      org_id: 'org-1',
      event_type: 'session.started',
      occurred_at: staleScheduledStart,
      source_kind: 'profile',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'session', id: 'live-session-stale-scheduled' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        liveSessionId: 'live-session-stale-scheduled',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'ELA with Mr Daniel',
        occurrenceStart: staleScheduledStart,
        isScheduledSessionWindow: true,
      },
      audience_rules: [],
      dedupe_key: 'session.started:live-session-stale-scheduled',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: staleScheduledStart,
      updated_at: staleScheduledStart,
    };

    const staleHuddleEvent = {
      ...staleScheduledEvent,
      id: 'event-session-started-stale-huddle',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: { kind: 'session', id: 'live-session-stale-huddle' },
      target_ref: null,
      payload: {
        liveSessionId: 'live-session-stale-huddle',
        channelId: 'channel-1',
        title: 'Direct message',
        channelTopic: 'Direct message',
        mode: 'video',
        startedByDisplayName: 'Tiffany T',
        startedAt: staleHuddleStart,
        isScheduledSessionWindow: false,
      },
      dedupe_key: 'session.started:live-session-stale-huddle',
      occurred_at: staleHuddleStart,
      created_at: staleHuddleStart,
      updated_at: staleHuddleStart,
    };

    expect(definition.render(staleScheduledEvent).actionButton).toBeUndefined();
    expect(
      definition.group.renderGroup?.(staleHuddleEvent)?.actionButton,
    ).toBeUndefined();
  });

  it('renders actor-owned session.started and member.joined with You label', () => {
    const started = getActivityEventDefinition('session.started');
    const joined = getActivityEventDefinition('member.joined');
    if (!started || !joined) {
      throw new Error('Missing live-session activity definitions');
    }

    const baseEvent = {
      id: 'event-live-actor-1',
      org_id: 'org-1',
      occurred_at: '2026-03-19T16:57:00.000Z',
      source_kind: 'profile' as const,
      actor_profile_id: 'profile-1',
      scope: { kind: 'channel' as const, channelId: 'channel-1' },
      object_ref: { kind: 'session' as const, id: 'live-session-1' },
      target_ref: null,
      audience_rules: [],
      projection_status: 'pending' as const,
      projection_attempts: 0,
      created_at: '2026-03-19T16:57:00.000Z',
      updated_at: '2026-03-19T16:57:00.000Z',
    };

    expect(
      started.render({
        ...baseEvent,
        event_type: 'session.started',
        dedupe_key: 'session.started:live-session-1',
        payload: {
          liveSessionId: 'live-session-1',
          channelId: 'channel-1',
          title: 'General',
          startedByDisplayName: 'Daniel W',
          mode: 'video',
          viewerIsActor: true,
        },
      }),
    ).toMatchObject({
      headline: { primary: 'You started a video huddle' },
    });

    expect(
      joined.render({
        ...baseEvent,
        event_type: 'member.joined',
        dedupe_key: 'member.joined:live-session-1:profile-1',
        payload: {
          liveSessionId: 'live-session-1',
          channelId: 'channel-1',
          memberProfileId: 'profile-1',
          memberDisplayName: 'Daniel W',
          mode: 'video',
          joinedAt: '2026-03-19T16:57:30.000Z',
          viewerIsActor: true,
        },
      }),
    ).toMatchObject({
      headline: { primary: 'You joined the huddle' },
    });
  });

  it('renders session reminders in the viewer timezone when provided', () => {
    const definition = getActivityEventDefinition('session.reminder.sent');
    if (!definition) {
      throw new Error('Missing session.reminder.sent definition');
    }

    const rendered = definition.render({
      id: 'event-6-viewer-timezone',
      org_id: 'org-1',
      event_type: 'session.reminder.sent',
      occurred_at: '2026-03-03T12:34:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-system',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-6' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-6',
        learningSpaceId: 'space-1',
        title: 'Algebra',
        occurrenceStart: '2026-03-03T12:40:00.000Z',
        reminderOffsetMinutes: 5,
        timezone: 'UTC',
        viewerTimezone: 'America/New_York',
        summary: 'Class starts in 10 minutes',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key: 'session.reminder:org-1:schedule-1:2026-03-03T12:40:00.000Z:activity',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:34:00.000Z',
      updated_at: '2026-03-03T12:34:00.000Z',
    });

    expect(rendered.summary).toBe(
      'Your session for Algebra will start on Mar 3 at 7:40 AM',
    );
  });

  it('renders child feedback request copy with the class name', () => {
    const definition = getActivityEventDefinition('session.feedback_request.sent');
    if (!definition) {
      throw new Error('Missing session.feedback_request.sent definition');
    }

    const rendered = definition.render({
      id: 'event-feedback-1',
      org_id: 'org-1',
      event_type: 'session.feedback_request.sent',
      occurred_at: '2026-03-03T14:40:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-system',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-feedback-1' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-feedback-1',
        learningSpaceId: 'space-1',
        title: 'Algebra',
        viewerRole: 'child',
        occurrenceStart: '2026-03-03T12:40:00.000Z',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key:
        'session.feedback_request:org-1:schedule-1:2026-03-03T12:40:00.000Z:activity',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T14:40:00.000Z',
      updated_at: '2026-03-03T14:40:00.000Z',
    });

    expect(rendered.headline).toEqual({
      primary: 'Class feedback requested',
      secondary: 'How was your Algebra session today?',
    });
    expect(rendered.metadata).toMatchObject({
      messageId: 'message-feedback-1',
      occurrenceStart: '2026-03-03T12:40:00.000Z',
      viewerRole: 'child',
      feedbackUiEnabled: true,
    });
  });

  it('renders guardian feedback request copy for one student', () => {
    const definition = getActivityEventDefinition('session.feedback_request.sent');
    if (!definition) {
      throw new Error('Missing session.feedback_request.sent definition');
    }

    const rendered = definition.render({
      id: 'event-feedback-guardian-1',
      org_id: 'org-1',
      event_type: 'session.feedback_request.sent',
      occurred_at: '2026-03-03T14:40:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-system',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-feedback-guardian-1' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-feedback-guardian-1',
        learningSpaceId: 'space-1',
        title: 'Algebra',
        viewerRole: 'guardian',
        members: [{ profileId: 'child-1', role: 'child', displayName: 'Ava' }],
        occurrenceStart: '2026-03-03T12:40:00.000Z',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key:
        'session.feedback_request:org-1:schedule-1:2026-03-03T12:40:00.000Z:activity',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T14:40:00.000Z',
      updated_at: '2026-03-03T14:40:00.000Z',
    });

    expect(rendered.headline.secondary).toBe("How was Ava's Algebra session today?");
    expect(rendered.metadata).toMatchObject({
      viewerRole: 'guardian',
      feedbackUiEnabled: true,
    });
  });

  it('renders educator feedback request copy for one student', () => {
    const definition = getActivityEventDefinition('session.feedback_request.sent');
    if (!definition) {
      throw new Error('Missing session.feedback_request.sent definition');
    }

    const rendered = definition.render({
      id: 'event-feedback-educator-1',
      org_id: 'org-1',
      event_type: 'session.feedback_request.sent',
      occurred_at: '2026-03-03T14:40:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-system',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-feedback-educator-1' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-feedback-educator-1',
        learningSpaceId: 'space-1',
        title: 'Algebra',
        viewerRole: 'educator',
        members: [{ profileId: 'child-1', role: 'child', displayName: 'Ava' }],
        occurrenceStart: '2026-03-03T12:40:00.000Z',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key:
        'session.feedback_request:org-1:schedule-1:2026-03-03T12:40:00.000Z:activity',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T14:40:00.000Z',
      updated_at: '2026-03-03T14:40:00.000Z',
    });

    expect(rendered.headline.secondary).toBe(
      "How did Ava do in today's Algebra session?",
    );
  });

  it('falls back to generic feedback request copy for multi-student guardian sessions', () => {
    const definition = getActivityEventDefinition('session.feedback_request.sent');
    if (!definition) {
      throw new Error('Missing session.feedback_request.sent definition');
    }

    const rendered = definition.render({
      id: 'event-feedback-guardian-many',
      org_id: 'org-1',
      event_type: 'session.feedback_request.sent',
      occurred_at: '2026-03-03T14:40:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-system',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-feedback-many' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-feedback-many',
        learningSpaceId: 'space-1',
        title: 'Algebra',
        viewerRole: 'guardian',
        members: [
          { profileId: 'child-1', role: 'child', displayName: 'Ava' },
          { profileId: 'child-2', role: 'child', displayName: 'Luca' },
        ],
        occurrenceStart: '2026-03-03T12:40:00.000Z',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key:
        'session.feedback_request:org-1:schedule-1:2026-03-03T12:40:00.000Z:activity',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T14:40:00.000Z',
      updated_at: '2026-03-03T14:40:00.000Z',
    });

    expect(rendered.headline.secondary).toBe("How was today's session?");
  });

  it('renders session participant join and leave activities with session icons', () => {
    const joined = getActivityEventDefinition('member.joined');
    const left = getActivityEventDefinition('member.removed');
    if (!joined || !left) {
      throw new Error('Missing member session activity definitions');
    }

    const baseEvent = {
      id: 'event-session-member-1',
      org_id: 'org-1',
      occurred_at: '2026-03-07T19:05:00.000Z',
      source_kind: 'provider_webhook' as const,
      actor_profile_id: null,
      scope: { kind: 'learning_space' as const, learningSpaceId: 'space-1' },
      object_ref: { kind: 'session' as const, id: 'live-session-1' },
      target_ref: { kind: 'learning_space' as const, id: 'space-1' },
      audience_rules: [],
      projection_status: 'pending' as const,
      projection_attempts: 0,
      created_at: '2026-03-07T19:05:00.000Z',
      updated_at: '2026-03-07T19:05:00.000Z',
      payload: {
        liveSessionId: 'live-session-1',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Math with Ms Charmain',
        occurrenceStart: '2026-03-07T19:00:00.000Z',
        memberProfileId: 'student-1',
        memberDisplayName: 'Tehara Morgan',
        members: [
          {
            profileId: 'student-1',
            displayName: 'Tehara Morgan',
            avatarUrl: 'https://cdn.test/tehara.png',
            themeKey: 'rose',
          },
        ],
      },
    };

    expect(
      joined.render({
        ...baseEvent,
        event_type: 'member.joined',
        dedupe_key: 'participant_joined:1',
        payload: { ...baseEvent.payload, joinedAt: '2026-03-07T19:05:00.000Z' },
      }),
    ).toMatchObject({
      headline: { primary: 'Tehara Morgan joined the huddle' },
      leading: {
        kind: 'icon',
        iconKey: 'Mic',
        tone: 'info',
      },
      summary: 'Joined at Mar 7 at 7:05 PM',
    });

    expect(
      joined.render({
        ...baseEvent,
        event_type: 'member.joined',
        dedupe_key: 'participant_joined:scheduled',
        payload: {
          ...baseEvent.payload,
          isScheduledSessionWindow: true,
          joinedAt: '2026-03-07T19:05:00.000Z',
        },
      }),
    ).toMatchObject({
      headline: { primary: 'Tehara Morgan joined the class session' },
      summary: 'Joined at Mar 7 at 7:05 PM',
    });

    expect(
      left.render({
        ...baseEvent,
        event_type: 'member.removed',
        dedupe_key: 'participant_left:1',
        payload: { ...baseEvent.payload, leftAt: '2026-03-07T19:45:00.000Z' },
      }),
    ).toMatchObject({
      headline: { primary: 'Tehara Morgan left the session' },
      summary: 'Left at Mar 7 at 7:45 PM',
    });
  });
});
