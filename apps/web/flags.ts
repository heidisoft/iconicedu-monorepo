import { flag, getProviderData as getCodeProviderData } from 'flags/next';
import { platformFeatureFlagKeys } from '@iconicedu/shared-types';

function resolveDistinctId(profileId?: string | null) {
  const resolved = profileId?.trim();
  if (resolved) {
    return resolved;
  }
  return 'anonymous';
}

function isEnvFlagEnabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isProductionDeployment() {
  return (
    (process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? '')
      .trim()
      .toLowerCase() === 'production'
  );
}

// Local-only escape hatch so developers can exercise the feature without
// PostHog targeting. Ignored on production deployments.
function isChannelCommunicationsForcedOn() {
  return (
    !isProductionDeployment() &&
    isEnvFlagEnabled(process.env.ENABLE_CHANNEL_COMMUNICATIONS)
  );
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
  key: platformFeatureFlagKeys.enableChannelCommunications,
  description:
    'Enables channel-level communication features that are still behind rollout control.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    if (isChannelCommunicationsForcedOn()) return true;
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

export const enableClassroomMeetingSettings = flag<
  boolean,
  { profileId?: string | null }
>({
  key: platformFeatureFlagKeys.enableClassroomMeetingSettings,
  description:
    'Enables configurable Classroom recording, collaboration, admission modes and co-host controls.',
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
  enableAssessments,
  enableChannelCommunications,
  enableMessagePinning,
  enableMessageSearch,
  enableMessageTypeComposer,
  enableScheduledSend,
  enableMessageMarkUnread,
  enableMessageReplyReference,
  enableNotificationConversationControls,
  enableMessageListFormatting,
  enableMobileAppleSignIn,
  enableMobileGoogleSignIn,
  enableMobileMessageComposerParity,
  enableMessageSendReliability,
} as const;

export type WebFlagKey = keyof typeof webFlags;

export function isVercelFlagsSdkConfigured() {
  const posthogKey =
    (process.env.NODE_ENV !== 'production'
      ? process.env.POSTHOG_FLAGS_KEY?.trim() || undefined
      : undefined) ??
    process.env.POSTHOG_KEY?.trim() ??
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ??
    '';
  const posthogHost =
    (process.env.NODE_ENV !== 'production'
      ? process.env.POSTHOG_FLAGS_HOST?.trim() || undefined
      : undefined) ??
    process.env.POSTHOG_HOST?.trim() ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ??
    '';
  return posthogKey.length > 0 && posthogHost.length > 0;
}

export async function getFlagsProviderData() {
  return getCodeProviderData(webFlags);
}

export const enableParentReferrals = flag<boolean>({
  key: platformFeatureFlagKeys.enableParentReferrals,
  description:
    'Enables parent referral sharing, landing pages and onboarding attribution.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide() {
    return evaluateWebBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableParentReferrals,
    });
  },
});
