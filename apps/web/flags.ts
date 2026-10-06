import { flag, getProviderData as getCodeProviderData } from 'flags/next';
import { platformFeatureFlagKeys } from '@iconicedu/shared-types';

function resolveDistinctId(profileId?: string | null) {
  const resolved = profileId?.trim();
  if (resolved) {
    return resolved;
  }
  return 'anonymous';
}

async function evaluateWebBooleanFlag(input: {
  flagKey: string;
  profileId?: string | null;
}) {
  const { evaluatePosthogBooleanFlag } =
    await import('@iconicedu/web/lib/flags/posthog-flags');
  return evaluatePosthogBooleanFlag({
    flagKey: input.flagKey,
    distinctId: resolveDistinctId(input.profileId),
  });
}

export const enableChannelCommunications = flag<boolean, { profileId?: string | null }>({
  key: 'enable-channel-communications',
  description:
    'Enables channel-level communication features that are still behind rollout control.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-channel-communications',
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageTypeComposer = flag<boolean, { profileId?: string | null }>({
  key: 'enable-message-type-composer',
  description: 'Shows the + create message type composer action in message inputs.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-message-type-composer',
      profileId: entities?.profileId,
    });
  },
});

export const enableMobileDirectMessageStart = flag<
  boolean,
  { profileId?: string | null }
>({
  key: platformFeatureFlagKeys.enableMobileDirectMessageStart,
  description:
    'Allows mobile users to start direct message conversations from profile previews and channel member rows.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMobileDirectMessageStart,
      profileId: entities?.profileId,
    });
  },
});

export const enableMobileGoogleSignIn = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMobileGoogleSignIn,
  description: 'Shows the Continue with Google option on the mobile login screen.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMobileGoogleSignIn,
      profileId: entities?.profileId,
    });
  },
});

export const enableMobileAppleSignIn = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMobileAppleSignIn,
  description: 'Shows the Continue with Apple option on the mobile login screen.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMobileAppleSignIn,
      profileId: entities?.profileId,
    });
  },
});

export const enableClassScheduleSeriesReschedule = flag<
  boolean,
  { profileId?: string | null }
>({
  key: 'enable-class-schedule-series-reschedule',
  description:
    'Shows the "This and following events"/"All events" quick-edit scopes on recurring class sessions and allows the corresponding split/whole-series reschedule server actions.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-class-schedule-series-reschedule',
      profileId: entities?.profileId,
    });
  },
});

export const enableMarketingSitePages = flag<boolean, { profileId?: string | null }>({
  key: 'enable-marketing-site-pages',
  description:
    'Enables standard marketing pages and regional microsite routes while content is staged.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-marketing-site-pages',
      profileId: entities?.profileId,
    });
  },
});

export const enableAssessments = flag<boolean, { profileId?: string | null }>({
  key: 'assessments-enabled',
  description:
    'Enables the assessment platform (item bank, tests, deliveries, adaptive engine, reports).',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'assessments-enabled',
      profileId: entities?.profileId,
    });
  },
});

export const enableSessionCompletionCarousel = flag<
  boolean,
  { profileId?: string | null }
>({
  key: platformFeatureFlagKeys.sessionCompletionCarousel,
  description: 'Shows actionable completed sessions on the web home dashboard.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.sessionCompletionCarousel,
      profileId: entities?.profileId,
    });
  },
});

export const enableAiRefine = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableAiRefine,
  description:
    'Shows the "Refine with AI" composer affordance that rewrites a draft via the Anthropic API before sending.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableAiRefine,
      profileId: entities?.profileId,
    });
  },
});

export const enableAiSuggestedReplies = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableAiSuggestedReplies,
  description:
    'Shows AI-generated suggested reply chips above the composer; suggestions are never auto-sent.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableAiSuggestedReplies,
      profileId: entities?.profileId,
    });
  },
});

export const enableAdminSessionAttendanceAnalytics = flag<
  boolean,
  { profileId?: string | null }
>({
  key: 'admin-session-attendance-analytics',
  description:
    'Enables monthly completed-session analytics, confirmer breakdowns, and advanced filters in admin.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'admin-session-attendance-analytics',
      profileId: entities?.profileId,
    });
  },
});

export const enableMessagePinning = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMessagePinning,
  description: 'Allows staff and educators to pin messages within a channel.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMessagePinning,
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageMarkUnread = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMessageMarkUnread,
  description: 'Shows the "Mark unread" message action and enables the mark-unread API.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMessageMarkUnread,
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageSearch = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMessageSearch,
  description: 'Shows the in-channel message search entry point.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMessageSearch,
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageReplyReference = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMessageReplyReference,
  description:
    'Enables quoting a specific message as an inline reply reference from the composer.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMessageReplyReference,
      profileId: entities?.profileId,
    });
  },
});

export const enableScheduledSend = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableScheduledSend,
  description: 'Allows composing messages to send at a future scheduled time.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableScheduledSend,
      profileId: entities?.profileId,
    });
  },
});

export const enableNotificationConversationControls = flag<
  boolean,
  { profileId?: string | null }
>({
  key: platformFeatureFlagKeys.enableNotificationConversationControls,
  description:
    'Shows per-conversation notification mode controls (normal/mentions-only/mute) in channel info.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableNotificationConversationControls,
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageListFormatting = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMessageListFormatting,
  description:
    'Enables bullet/numbered list composer toolbar buttons and rendering of list-formatted messages.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMessageListFormatting,
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageDrafts = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMessageDrafts,
  description:
    'Autosaves and restores in-progress message drafts (main and thread composers) on web and mobile.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMessageDrafts,
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageEdit = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMessageEdit,
  description:
    'Lets a sender edit their own eligible text message within the edit window, on web and mobile.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMessageEdit,
      profileId: entities?.profileId,
    });
  },
});

export const enableMobileMessageComposerParity = flag<
  boolean,
  { profileId?: string | null }
>({
  key: platformFeatureFlagKeys.enableMobileMessageComposerParity,
  description:
    'Enables authoring person mentions and bold/italic formatting from the mobile composer.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMobileMessageComposerParity,
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageSendReliability = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableMessageSendReliability,
  description:
    'Enables idempotent send retries and attachment upload recovery for failed sends on web and mobile.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableMessageSendReliability,
      profileId: entities?.profileId,
    });
  },
});

export const enableSessionCompletionVerifiedDuration = flag<
  boolean,
  { profileId?: string | null }
>({
  key: platformFeatureFlagKeys.enableSessionCompletionVerifiedDuration,
  description:
    'Lets staff confirm a completed session with a verified partial duration (and note) instead of only the full scheduled length, and use it to resolve an open dispute.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableSessionCompletionVerifiedDuration,
      profileId: entities?.profileId,
    });
  },
});

export const enableSessionCompletionDisputeDetails = flag<
  boolean,
  { profileId?: string | null }
>({
  key: platformFeatureFlagKeys.enableSessionCompletionDisputeDetails,
  description:
    'Shows the reported dispute category and reason under a disputed participant in the admin completed-sessions list.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableSessionCompletionDisputeDetails,
      profileId: entities?.profileId,
    });
  },
});

export const enableOrgAiProviderSettings = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableOrgAiProviderSettings,
  description:
    'Shows the admin "Organization Settings → AI-assisted messaging" page for configuring a per-org AI provider, model, and API key.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableOrgAiProviderSettings,
      profileId: entities?.profileId,
    });
  },
});

export const enableClassroomMeetingSettings = flag<
  boolean,
  { profileId?: string | null }
>({
  key: platformFeatureFlagKeys.enableClassroomMeetingSettings,
  description: 'Enables configurable Classroom recording and collaboration modules.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableClassroomMeetingSettings,
      profileId: entities?.profileId,
    });
  },
});

export const enableClassroomWhiteboard = flag<boolean, { profileId?: string | null }>({
  key: platformFeatureFlagKeys.enableClassroomWhiteboard,
  description:
    'Uses the application collaborative whiteboard with Excalidraw by default.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableClassroomWhiteboard,
      profileId: entities?.profileId,
    });
  },
});

export const webFlags = {
  enableClassroomWhiteboard,
  enableClassroomMeetingSettings,
  enableAdminSessionAttendanceAnalytics,
  enableAiRefine,
  enableAiSuggestedReplies,
  enableAssessments,
  enableChannelCommunications,
  enableClassScheduleSeriesReschedule,
  enableMarketingSitePages,
  enableMessagePinning,
  enableMessageSearch,
  enableMessageTypeComposer,
  enableScheduledSend,
  enableMessageMarkUnread,
  enableMessageReplyReference,
  enableNotificationConversationControls,
  enableMessageListFormatting,
  enableSessionCompletionCarousel,
  enableMobileAppleSignIn,
  enableMobileDirectMessageStart,
  enableMobileGoogleSignIn,
  enableMessageDrafts,
  enableMessageEdit,
  enableMobileMessageComposerParity,
  enableMessageSendReliability,
  enableSessionCompletionVerifiedDuration,
  enableSessionCompletionDisputeDetails,
  enableOrgAiProviderSettings,
} as const;

export type WebFlagKey = keyof typeof webFlags;

export function isVercelFlagsSdkConfigured() {
  const posthogKey =
    process.env.POSTHOG_KEY?.trim() ?? process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '';
  const posthogHost =
    process.env.POSTHOG_HOST?.trim() ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ??
    '';
  return posthogKey.length > 0 && posthogHost.length > 0;
}

export async function getFlagsProviderData() {
  return getCodeProviderData(webFlags);
}
