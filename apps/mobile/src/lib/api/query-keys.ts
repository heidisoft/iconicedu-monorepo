export const queryKeys = {
  onboardingStatus: (userId: string) => ['onboarding-status', userId] as const,
  profile: (profileId: string) => ['profile', profileId] as const,
  channels: (orgId: string) => ['channels', orgId] as const,
  directMessages: (orgId: string, profileId: string) =>
    ['directMessages', orgId, profileId] as const,
  directMessageChannelMeta: (channelId: string, orgId: string, profileId: string) =>
    ['directMessageChannelMeta', channelId, orgId, profileId] as const,
  channel: (channelId: string) => ['channel', channelId] as const,
  channelMeta: (channelId: string, orgId: string, accountId: string) =>
    ['channelMeta', channelId, orgId, accountId] as const,
  spaceChannelMeta: (channelId: string) => ['spaceChannelMeta', channelId] as const,
  messages: (channelId: string, profileId = '') =>
    ['messages', channelId, profileId] as const,
  channelReadState: (channelId: string, accountId: string) =>
    ['channelReadState', channelId, accountId] as const,
  channelMembership: (orgId: string, channelId: string, profileId: string) =>
    ['channelMembership', orgId, channelId, profileId] as const,
  learningSpaces: (orgId: string) => ['learningSpaces', orgId] as const,
  learningSpace: (spaceId: string) => ['learningSpace', spaceId] as const,
  supportChannel: (orgId: string) => ['supportChannel', orgId] as const,
  inbox: (orgId: string, profileId: string) => ['inbox', orgId, profileId] as const,
  sidebar: (orgId: string, profileId: string) => ['sidebar', orgId, profileId] as const,
  notificationPrefs: (orgId: string, profileId: string) =>
    ['notificationPrefs', orgId, profileId] as const,
  familyLinks: (orgId: string, accountId: string) =>
    ['familyLinks', orgId, accountId] as const,
  childProfiles: (orgId: string, accountIds: string[]) =>
    ['childProfiles', orgId, accountIds] as const,
  spaceSchedules: (channelId: string, orgId: string) =>
    ['space-sessions', channelId, orgId] as const,
  orgSessions: (orgId: string) => ['org-sessions', orgId] as const,
  sessionCompletions: (orgId: string, profileId: string) =>
    ['session-completions', orgId, profileId] as const,
  supervisedDirectMessages: (orgId: string, accountId: string) =>
    ['supervisedDirectMessages', orgId, accountId] as const,
} as const;
