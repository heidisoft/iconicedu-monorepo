import type { LiveSessionProviderVM } from '@iconicedu/shared-types';

import type { LiveSessionProviderAdapter } from '../types';
import { dailyLiveSessionProvider } from './daily-provider';
import { zoomVideoSdkLiveSessionProvider } from './zoom-video-sdk-provider';

export { verifyZoomPasscode } from './zoom-video-sdk-provider';

const providers = new Map<LiveSessionProviderVM, LiveSessionProviderAdapter>([
  ['daily', dailyLiveSessionProvider],
  ['zoom', zoomVideoSdkLiveSessionProvider],
]);

export function getLiveSessionProvider(provider: LiveSessionProviderVM) {
  const adapter = providers.get(provider);
  if (!adapter) {
    throw new Error(`Unsupported live session provider: ${provider}`);
  }
  return adapter;
}

// Lets the webhook route answer a provider's own pre-pipeline handshake (if
// it has one — see LiveSessionProviderAdapter.handleWebhookChallenge)
// generically, without branching on the provider's name.
export function handleProviderWebhookChallenge(
  provider: LiveSessionProviderVM,
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  return getLiveSessionProvider(provider).handleWebhookChallenge?.(body) ?? null;
}
