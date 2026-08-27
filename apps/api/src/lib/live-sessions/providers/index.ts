import type { LiveSessionProviderVM } from '@iconicedu/shared-types';

import type { LiveSessionProviderAdapter } from '@iconicedu/api/lib/live-sessions/types';
import { dailyLiveSessionProvider } from '@iconicedu/api/lib/live-sessions/providers/daily-provider';

const providers = new Map<LiveSessionProviderVM, LiveSessionProviderAdapter>([
  ['daily', dailyLiveSessionProvider],
]);

export function getLiveSessionProvider(provider: LiveSessionProviderVM) {
  const adapter = providers.get(provider);
  if (!adapter) {
    throw new Error(`Unsupported live session provider: ${provider}`);
  }
  return adapter;
}
