import type {
  ChannelVM,
  PresenceVM,
  SidebarLeftDataVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

function applyRealtimeOnlineStatus(
  profile: UserProfileVM,
  onlineProfileIds: Set<string>,
): UserProfileVM {
  const isOnline = onlineProfileIds.has(profile.ids.id);
  const currentPresence = profile.presence;

  if (isOnline) {
    const nextDisplayStatus =
      currentPresence?.displayStatus === 'busy' ? 'busy' : 'online';
    const nextLiveStatus =
      currentPresence?.displayStatus === 'busy' ? 'busy' : 'online';
    const nextPresence: PresenceVM = {
      state: currentPresence?.state ?? {},
      liveStatus: nextLiveStatus,
      displayStatus: nextDisplayStatus,
      lastSeenAt: currentPresence?.lastSeenAt ?? null,
      presenceLoaded: true,
    };
    if (
      currentPresence &&
      currentPresence.liveStatus === nextPresence.liveStatus &&
      currentPresence.displayStatus === nextPresence.displayStatus &&
      currentPresence.presenceLoaded === nextPresence.presenceLoaded
    ) {
      return profile;
    }
    return { ...profile, presence: nextPresence };
  }

  if (
    currentPresence?.liveStatus === 'online' &&
    currentPresence.displayStatus === 'online'
  ) {
    return {
      ...profile,
      presence: {
        ...currentPresence,
        liveStatus: 'away',
        displayStatus: 'away',
      },
    };
  }

  return profile;
}

function applyPresenceToProfile(
  profile: UserProfileVM,
  profileId: string,
  presence: PresenceVM | null,
) {
  if (profile.ids.id !== profileId) {
    return profile;
  }
  return {
    ...profile,
    presence,
  };
}

export function applyPresenceToChannelParticipants(
  channel: ChannelVM,
  profileId: string,
  presence: PresenceVM | null,
): ChannelVM {
  let hasChanges = false;
  const nextParticipants = channel.collections.participants.map((participant) => {
    const updated = applyPresenceToProfile(participant, profileId, presence);
    if (updated !== participant) {
      hasChanges = true;
    }
    return updated;
  });

  if (!hasChanges) {
    return channel;
  }

  return {
    ...channel,
    collections: {
      ...channel.collections,
      participants: nextParticipants,
    },
  };
}

export function applyRealtimeOnlineProfilesToChannelParticipants(
  channel: ChannelVM,
  onlineProfileIds: Set<string>,
): ChannelVM {
  let hasChanges = false;
  const nextParticipants = channel.collections.participants.map((participant) => {
    const updated = applyRealtimeOnlineStatus(participant, onlineProfileIds);
    if (updated !== participant) {
      hasChanges = true;
    }
    return updated;
  });

  if (!hasChanges) {
    return channel;
  }

  return {
    ...channel,
    collections: {
      ...channel.collections,
      participants: nextParticipants,
    },
  };
}

export function applyPresenceToSidebarData(
  sidebarData: SidebarLeftDataVM,
  profileId: string,
  presence: PresenceVM | null,
): SidebarLeftDataVM {
  const nextProfile = applyPresenceToProfile(sidebarData.user.profile, profileId, presence);
  const nextDirectMessages = sidebarData.collections.directMessages.map((channel) =>
    applyPresenceToChannelParticipants(channel, profileId, presence),
  );
  const nextLearningSpaces = sidebarData.collections.learningSpaces.map((space) => {
    let hasSpaceChanges = false;
    const nextParticipants = space.participants.map((participant) => {
      const updated = applyPresenceToProfile(participant, profileId, presence);
      if (updated !== participant) {
        hasSpaceChanges = true;
      }
      return updated;
    });
    if (!hasSpaceChanges) {
      return space;
    }
    return {
      ...space,
      participants: nextParticipants,
    };
  });

  const hasDirectMessageChanges = nextDirectMessages.some(
    (channel, index) => channel !== sidebarData.collections.directMessages[index],
  );
  const hasLearningSpaceChanges = nextLearningSpaces.some(
    (space, index) => space !== sidebarData.collections.learningSpaces[index],
  );

  if (
    nextProfile === sidebarData.user.profile &&
    !hasDirectMessageChanges &&
    !hasLearningSpaceChanges
  ) {
    return sidebarData;
  }

  return {
    ...sidebarData,
    user: {
      ...sidebarData.user,
      profile: nextProfile,
    },
    collections: {
      ...sidebarData.collections,
      directMessages: nextDirectMessages,
      learningSpaces: nextLearningSpaces,
    },
  };
}

export function applyRealtimeOnlineProfilesToSidebarData(
  sidebarData: SidebarLeftDataVM,
  onlineProfileIds: Set<string>,
): SidebarLeftDataVM {
  const nextProfile = applyRealtimeOnlineStatus(sidebarData.user.profile, onlineProfileIds);
  const nextDirectMessages = sidebarData.collections.directMessages.map((channel) =>
    applyRealtimeOnlineProfilesToChannelParticipants(channel, onlineProfileIds),
  );
  const nextLearningSpaces = sidebarData.collections.learningSpaces.map((space) => {
    let hasSpaceChanges = false;
    const nextParticipants = space.participants.map((participant) => {
      const updated = applyRealtimeOnlineStatus(participant, onlineProfileIds);
      if (updated !== participant) {
        hasSpaceChanges = true;
      }
      return updated;
    });
    if (!hasSpaceChanges) {
      return space;
    }
    return {
      ...space,
      participants: nextParticipants,
    };
  });

  const hasDirectMessageChanges = nextDirectMessages.some(
    (channel, index) => channel !== sidebarData.collections.directMessages[index],
  );
  const hasLearningSpaceChanges = nextLearningSpaces.some(
    (space, index) => space !== sidebarData.collections.learningSpaces[index],
  );

  if (
    nextProfile === sidebarData.user.profile &&
    !hasDirectMessageChanges &&
    !hasLearningSpaceChanges
  ) {
    return sidebarData;
  }

  return {
    ...sidebarData,
    user: {
      ...sidebarData.user,
      profile: nextProfile,
    },
    collections: {
      ...sidebarData.collections,
      directMessages: nextDirectMessages,
      learningSpaces: nextLearningSpaces,
    },
  };
}
