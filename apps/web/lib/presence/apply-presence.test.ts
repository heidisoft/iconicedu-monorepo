import { describe, expect, it } from 'vitest';
import type {
  ChannelVM,
  PresenceVM,
  SidebarLeftDataVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import {
  applyPresenceToChannelParticipants,
  applyRealtimeOnlineProfilesToChannelParticipants,
  applyRealtimeOnlineProfilesToSidebarData,
  applyPresenceToSidebarData,
} from '@iconicedu/web/lib/presence/apply-presence';

const makeProfile = (id: string): UserProfileVM =>
  ({
    ids: { id, orgId: 'org-1', accountId: `account-${id}` },
    kind: 'guardian',
    profile: {
      displayName: `User ${id}`,
      avatar: { source: 'seed', url: null },
    },
    prefs: {},
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ui: { themeKey: null },
    joinedDate: '2026-01-01T00:00:00.000Z',
    presence: null,
  }) as unknown as UserProfileVM;

const makeChannel = (): ChannelVM =>
  ({
    ids: { id: 'channel-1', orgId: 'org-1' },
    basics: {
      kind: 'dm',
      topic: 'DM',
      iconKey: null,
      description: null,
      visibility: 'private',
      purpose: 'general',
    },
    lifecycle: {
      status: 'active',
      createdBy: 'profile-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    postingPolicy: {
      kind: 'members-only',
      allowThreads: true,
      allowReactions: true,
    },
    collections: {
      participants: [makeProfile('profile-1'), makeProfile('profile-2')],
      messages: { items: [], total: 0 },
      media: { items: [], total: 0 },
      files: { items: [], total: 0 },
    },
  }) as unknown as ChannelVM;

const makeSidebarData = (): SidebarLeftDataVM =>
  ({
    user: {
      profile: makeProfile('profile-1'),
    },
    navigation: { navMain: [], navSecondary: [] },
    collections: {
      directMessages: [makeChannel()],
      learningSpaces: [],
    },
  }) as unknown as SidebarLeftDataVM;

const busyPresence: PresenceVM = {
  state: { text: 'Heads down', emoji: '🚫' },
  liveStatus: 'busy',
  displayStatus: 'busy',
  presenceLoaded: true,
};

describe('apply presence helpers', () => {
  it('applies presence to matching channel participant only', () => {
    const channel = makeChannel();
    const updated = applyPresenceToChannelParticipants(
      channel,
      'profile-2',
      busyPresence,
    );

    expect(updated.collections.participants[0].presence).toBeNull();
    expect(updated.collections.participants[1].presence?.liveStatus).toBe('busy');
  });

  it('returns original channel when profile is not a participant', () => {
    const channel = makeChannel();
    const updated = applyPresenceToChannelParticipants(
      channel,
      'profile-999',
      busyPresence,
    );

    expect(updated).toBe(channel);
  });

  it('updates sidebar user profile and direct message participants', () => {
    const sidebarData = makeSidebarData();
    const updated = applyPresenceToSidebarData(sidebarData, 'profile-1', busyPresence);

    expect(updated.user.profile.presence?.displayStatus).toBe('busy');
    expect(
      updated.collections.directMessages[0].collections.participants[0].presence
        ?.liveStatus,
    ).toBe('busy');
  });

  it('overrides participants to online from realtime presence', () => {
    const channel = makeChannel();
    const updated = applyRealtimeOnlineProfilesToChannelParticipants(
      channel,
      new Set(['profile-2']),
    );

    expect(updated.collections.participants[1].presence?.displayStatus).toBe('online');
    expect(updated.collections.participants[1].presence?.liveStatus).toBe('online');
  });

  it('preserves busy status when realtime shows profile online', () => {
    const channel = makeChannel();
    const withBusy = applyPresenceToChannelParticipants(
      channel,
      'profile-2',
      busyPresence,
    );
    const updated = applyRealtimeOnlineProfilesToChannelParticipants(
      withBusy,
      new Set(['profile-2']),
    );

    expect(updated.collections.participants[1].presence?.displayStatus).toBe('busy');
    expect(updated.collections.participants[1].presence?.liveStatus).toBe('busy');
  });

  it('applies realtime online overlay across sidebar collections', () => {
    const sidebarData = makeSidebarData();
    const updated = applyRealtimeOnlineProfilesToSidebarData(
      sidebarData,
      new Set(['profile-1']),
    );

    expect(updated.user.profile.presence?.displayStatus).toBe('online');
    expect(
      updated.collections.directMessages[0].collections.participants[0].presence
        ?.displayStatus,
    ).toBe('online');
  });
});
