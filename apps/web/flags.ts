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

export const enableWebRecaptcha = flag<boolean, { profileId?: string | null }>({
  key: 'enable-web-recaptcha',
  description: 'Requires Google reCAPTCHA for web email login and sign-up submissions.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-web-recaptcha',
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

export const webFlags = {
  enableAssessments,
  enableChannelCommunications,
  enableMarketingSitePages,
  enableMessageTypeComposer,
  enableMobileAppleSignIn,
  enableMobileDirectMessageStart,
  enableMobileGoogleSignIn,
  enableWebRecaptcha,
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
