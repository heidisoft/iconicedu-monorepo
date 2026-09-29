import type { LiveSessionProviderVM } from '@iconicedu/shared-types';

import type { LiveSessionProviderAdapter } from '../types';
import { dailyLiveSessionProvider } from './daily-provider';

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
