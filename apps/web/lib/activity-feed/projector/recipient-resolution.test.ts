import { describe, expect, it, vi } from 'vitest';

import { resolveRecipientsForActivityEvent } from '@iconicedu/web/lib/activity-feed/projector/recipient-resolution';

function createSupabaseMock() {
  const channelMembers = [
    { profile_id: 'profile-target' },
    { profile_id: 'profile-actor' },
  ];
  const learningSpaceParticipants = [{ profile_id: 'profile-space' }];
  return {
    from: vi.fn((table: string) => {
      if (table === 'channel_members') {
        const channelChain = {
          eq: vi.fn(() => channelChain),
          is: vi.fn(() => channelChain),
          returns: vi.fn(async () => ({
            data: channelMembers,
            error: null,
          })),
        };

        return {
          select: vi.fn(() => channelChain),
        };
      }

      if (table === 'learning_space_participants') {
        const participantChain = {
          eq: vi.fn(() => participantChain),
          is: vi.fn(() => participantChain),
          returns: vi.fn(async () => ({
            data: learningSpaceParticipants,
            error: null,
          })),
        };

        return {
          select: vi.fn(() => participantChain),
        };
      }

      if (table === 'family_links') {
        const familyLinkChain = {
          eq: vi.fn(() => familyLinkChain),
          in: vi.fn(() => familyLinkChain),
          is: vi.fn(() => familyLinkChain),
          returns: vi.fn(async () => ({
            data: [],
            error: null,
          })),
        };

        return {
          select: vi.fn(() => familyLinkChain),
        };
      }

      if (table === 'profiles') {
        const profileChain = {
          eq: vi.fn(() => profileChain),
          in: vi.fn(() => profileChain),
          is: vi.fn(() => profileChain),
          returns: vi.fn(async () => ({
            data: [],
            error: null,
          })),
        };

        return {
          select: vi.fn(() => profileChain),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('resolveRecipientsForActivityEvent', () => {
  it('keeps user-scope recipients regardless of delivery preferences', async () => {
    const recipients = await resolveRecipientsForActivityEvent(
      createSupabaseMock() as never,
      {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'message.posted',
        occurred_at: '2026-03-09T10:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'user', userId: 'profile-target' },
        object_ref: null,
        target_ref: null,
        payload: {},
        audience_rules: [],
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-09T10:00:00.000Z',
        updated_at: '2026-03-09T10:00:00.000Z',
      },
    );

    expect(recipients).toEqual(['profile-target']);
  });

  it('filters channel-scope recipients by users_only audience rule', async () => {
    const recipients = await resolveRecipientsForActivityEvent(
      createSupabaseMock() as never,
      {
        id: 'event-2',
        org_id: 'org-1',
        event_type: 'message.posted',
        occurred_at: '2026-03-09T10:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: null,
        target_ref: null,
        payload: {},
        audience_rules: [{ kind: 'users_only', userIds: ['profile-target'] }],
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-09T10:00:00.000Z',
        updated_at: '2026-03-09T10:00:00.000Z',
      },
    );

    expect(recipients).toEqual(['profile-target']);
  });

  it('returns empty recipients when channel-scope users_only excludes members', async () => {
    const recipients = await resolveRecipientsForActivityEvent(
      createSupabaseMock() as never,
      {
        id: 'event-3',
        org_id: 'org-1',
        event_type: 'message.posted',
        occurred_at: '2026-03-09T10:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: null,
        target_ref: null,
        payload: {},
        audience_rules: [{ kind: 'users_only', userIds: ['profile-someone-else'] }],
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-09T10:00:00.000Z',
        updated_at: '2026-03-09T10:00:00.000Z',
      },
    );

    expect(recipients).toEqual([]);
  });

  it('uses learning-space recipients for learning-space scoped events', async () => {
    const recipients = await resolveRecipientsForActivityEvent(
      createSupabaseMock() as never,
      {
        id: 'event-4',
        org_id: 'org-1',
        event_type: 'class.session.canceled',
        occurred_at: '2026-03-09T10:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        object_ref: { kind: 'session', id: 'session-1' },
        target_ref: { kind: 'learning_space', id: 'space-1' },
        payload: {
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
        },
        audience_rules: [],
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-09T10:00:00.000Z',
        updated_at: '2026-03-09T10:00:00.000Z',
      },
    );

    expect(recipients).toEqual(['profile-space']);
  });

  it('excludes the actor for channel-scoped reaction events', async () => {
    const recipients = await resolveRecipientsForActivityEvent(
      createSupabaseMock() as never,
      {
        id: 'event-5',
        org_id: 'org-1',
        event_type: 'reaction.added',
        occurred_at: '2026-03-09T10:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: { kind: 'message', id: 'message-1' },
        target_ref: null,
        payload: {
          channelId: 'channel-1',
        },
        audience_rules: [],
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-09T10:00:00.000Z',
        updated_at: '2026-03-09T10:00:00.000Z',
      },
    );

    expect(recipients).toEqual(['profile-target']);
  });

  it('still excludes actor for non-live-session events', async () => {
    const recipients = await resolveRecipientsForActivityEvent(
      createSupabaseMock() as never,
      {
        id: 'event-6',
        org_id: 'org-1',
        event_type: 'message.posted',
        occurred_at: '2026-03-09T10:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: null,
        target_ref: null,
        payload: {
          channelId: 'channel-1',
        },
        audience_rules: [],
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-09T10:00:00.000Z',
        updated_at: '2026-03-09T10:00:00.000Z',
      },
    );

    expect(recipients).toEqual(['profile-target']);
  });
});
