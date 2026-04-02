import { flag, getProviderData as getCodeProviderData } from 'flags/next';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

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

export const enableAdminReports = flag<boolean, { profileId?: string | null }>({
  key: 'enable-admin-reports',
  description: 'Enables the admin reporting dashboard and navigation entry.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: true,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-admin-reports',
      profileId: entities?.profileId,
    });
  },
});

export const webFlags = {
  enableAdminReports,
  enableChannelCommunications,
  enableMessageTypeComposer,
} as const;

export type WebFlagKey = keyof typeof webFlags;

export function isVercelFlagsSdkConfigured() {
  const appUrl = resolveAppUrl();
  const hostname = new URL(appUrl).hostname;
  const isLocalHost =
    process.env.NODE_ENV === 'development' &&
    (hostname === 'localhost' || hostname === '127.0.0.1');
  if (isLocalHost) {
    return false;
  }

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
