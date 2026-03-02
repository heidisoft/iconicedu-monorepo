import { flag, getProviderData as getCodeProviderData } from 'flags/next';

export const enableChannelCommunications = flag<boolean>({
  key: 'enable-channel-communications',
  description: 'Enables channel-level communication features that are still behind rollout control.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  decide() {
    return false;
  },
});

export const webFlags = {
  enableChannelCommunications,
} as const;

export type WebFlagKey = keyof typeof webFlags;

export function isVercelFlagsSdkConfigured() {
  return false;
}

export async function getFlagsProviderData() {
  return getCodeProviderData(webFlags);
}
