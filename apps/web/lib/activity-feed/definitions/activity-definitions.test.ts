import { describe, expect, it } from 'vitest';

import { getActivityEventDefinition } from '@iconicedu/web/lib/activity-feed/definitions/activity-definitions';

describe('activity event definitions', () => {
  it('renders direct message activity headline and no action button', () => {
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
        channelRouteKind: 'dm',
      },
      audience_rules: [],
      dedupe_key: 'dm.posted:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Jane sent you a direct message');
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
    const sessionScheduled = getActivityEventDefinition('session.scheduled');

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
      event_type: 'session.scheduled',
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
    const sessionScheduled = getActivityEventDefinition('session.scheduled');
    const sessionCanceled = getActivityEventDefinition('session.canceled');
    const classUpdated = getActivityEventDefinition('class.updated');

    if (
      !memberInvited?.group ||
      !memberRemoved?.group ||
      !sessionScheduled?.group ||
      !sessionCanceled?.group ||
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
      event_type: 'session.scheduled',
    });
    const sessionCanceledKey = sessionCanceled.group.buildGroupKey({
      ...event,
      event_type: 'session.canceled',
    });

    expect(classUpdatedKey).toBe('class-updated:space-1:2026-03-06');
    expect(memberKey).toBe(classUpdatedKey);
    expect(memberRemovedKey).toBe(classUpdatedKey);
    expect(sessionScheduledKey).toBe(classUpdatedKey);
    expect(sessionCanceledKey).toBe(classUpdatedKey);

    const nextDayKey = classUpdated.group.buildGroupKey({
      ...event,
      occurred_at: '2026-03-07T01:10:00.000Z',
      created_at: '2026-03-07T01:10:00.000Z',
      updated_at: '2026-03-07T01:10:00.000Z',
    });
    expect(nextDayKey).toBe('class-updated:space-1:2026-03-07');
    expect(nextDayKey).not.toBe(classUpdatedKey);
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

  it('renders session scheduled summary and schedule-tab action', () => {
    const definition = getActivityEventDefinition('session.scheduled');
    if (!definition) {
      throw new Error('Missing session.scheduled definition');
    }

    const rendered = definition.render({
      id: 'event-session-scheduled-1',
      org_id: 'org-1',
      event_type: 'session.scheduled',
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
      dedupe_key: 'session.scheduled:space-1:2026-03-07',
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
    const definition = getActivityEventDefinition('session.scheduled');
    if (!definition) {
      throw new Error('Missing session.scheduled definition');
    }

    const rendered = definition.render({
      id: 'event-session-scheduled-updated-1',
      org_id: 'org-1',
      event_type: 'session.scheduled',
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
      dedupe_key: 'session.scheduled:space-1:2026-03-07',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    });

    expect(rendered.headline.primary).toBe('Session scheduled');
    expect(rendered.summary).toBe('Session scheduled Mar 7 at 2:00 PM.');
  });

  it('renders rescheduled and cancelled sessions with calendar-check/calendar-x and first-session summary', () => {
    const rescheduled = getActivityEventDefinition('session.rescheduled');
    const canceled = getActivityEventDefinition('session.canceled');
    if (!rescheduled || !canceled) {
      throw new Error('Missing session schedule change definitions');
    }

    const rescheduledRendered = rescheduled.render({
      id: 'event-session-rescheduled-1',
      org_id: 'org-1',
      event_type: 'session.rescheduled',
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
      dedupe_key: 'session.rescheduled:space-1:1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-08T12:00:00.000Z',
      updated_at: '2026-03-08T12:00:00.000Z',
    });
    expect(rescheduledRendered.headline.primary).toBe(
      'Session Mar 8 at 3:00 PM rescheduled to Mar 15 at 2:30 PM',
    );
    expect(rescheduledRendered.summary).toBe('Next session Mar 15 at 2:30 PM.');
    expect(rescheduledRendered.leading).toEqual({
      kind: 'icon',
      iconKey: 'CalendarCheck',
      tone: 'info',
    });
    expect(rescheduledRendered.actionButton).toBeUndefined();

    const canceledRendered = canceled.render({
      id: 'event-session-canceled-1',
      org_id: 'org-1',
      event_type: 'session.canceled',
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
      dedupe_key: 'session.canceled:space-1:1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-08T12:00:00.000Z',
      updated_at: '2026-03-08T12:00:00.000Z',
    });
    expect(canceledRendered.headline.primary).toBe(
      'Session Mar 15 at 2:30 PM cancelled Holiday',
    );
    expect(canceledRendered.summary).toBe('Next session Mar 22 at 2:30 PM.');
    expect(canceledRendered.leading).toEqual({
      kind: 'icon',
      iconKey: 'CalendarX',
      tone: 'warning',
    });
    expect(canceledRendered.actionButton).toBeUndefined();
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
        title: 'Algebra',
        occurrenceStart: '2026-03-03T12:40:00.000Z',
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
      'class-session:space-1:2026-03-03T12:40',
    );
    expect(sessionStarted.group.buildGroupKey(event)).toBe(
      'class-session:space-1:2026-03-03T12:40',
    );
    expect(sessionEnded.group.buildGroupKey(event)).toBe(
      'class-session:space-1:2026-03-03T12:40',
    );
    expect(definition.render(event)).toMatchObject({
      headline: {
        primary: 'Upcoming class reminder',
        secondary: 'Algebra',
      },
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

    expect(definition.group.renderGroup?.(event)).toMatchObject({
      headline: {
        primary: 'Class session 2026-03-03T12:40:00.000Z',
        secondary: 'Algebra',
      },
      actionButton: undefined,
      metadata: {
        hideActionButton: true,
        sessionGroupLocalTime: true,
      },
    });
  });

  it('renders session feedback request with class feedback headline', () => {
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
      secondary: "How was today's session?",
    });
    expect(rendered.metadata).toMatchObject({
      messageId: 'message-feedback-1',
      occurrenceStart: '2026-03-03T12:40:00.000Z',
    });
  });

  it('renders session participant join and leave activities with participant avatars', () => {
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
      headline: { primary: 'Tehara Morgan joined the session' },
      leading: {
        kind: 'avatars',
        avatars: [
          {
            name: 'Tehara Morgan',
            avatar: { source: 'upload', url: 'https://cdn.test/tehara.png' },
            themeKey: 'rose',
          },
        ],
      },
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
