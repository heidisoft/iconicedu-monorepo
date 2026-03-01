import { getProviderData as getVercelProviderData, vercelAdapter } from '@flags-sdk/vercel';
import { flag, getProviderData as getCodeProviderData } from 'flags/next';

const hasVercelFlagsSdk = Boolean(process.env.FLAGS?.trim());
const adapter = hasVercelFlagsSdk ? vercelAdapter<boolean, any>() : undefined;

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
  ...(adapter ? { adapter } : {}),
});

export const webFlags = {
  enableChannelCommunications,
} as const;

export type WebFlagKey = keyof typeof webFlags;

export function isVercelFlagsSdkConfigured() {
  return hasVercelFlagsSdk;
}

export async function getFlagsProviderData() {
  const codeProviderData = getCodeProviderData(webFlags);

  if (!hasVercelFlagsSdk) {
    return codeProviderData;
  }

  const providerData = await getVercelProviderData(webFlags);

  return {
    definitions: {
      ...codeProviderData.definitions,
      ...providerData.definitions,
    },
    hints: [...codeProviderData.hints, ...providerData.hints],
  };
}
