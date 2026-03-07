import { flag, getProviderData as getCodeProviderData } from 'flags/next';

export const enableChannelCommunications = flag<boolean>({
  key: 'enable-channel-communications',
  description:
    'Enables channel-level communication features that are still behind rollout control.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  decide() {
    return false;
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
    const profileId = entities?.profileId?.trim();
    if (!profileId) {
      return false;
    }
    const { evaluatePosthogBooleanFlag } =
      await import('@iconicedu/web/lib/flags/posthog-flags');
    return evaluatePosthogBooleanFlag({
      flagKey: 'enable-message-type-composer',
      distinctId: profileId,
    });
  },
});

export const webFlags = {
  enableChannelCommunications,
  enableMessageTypeComposer,
} as const;

export type WebFlagKey = keyof typeof webFlags;

export function isVercelFlagsSdkConfigured() {
  return false;
}

export async function getFlagsProviderData() {
  return getCodeProviderData(webFlags);
}
