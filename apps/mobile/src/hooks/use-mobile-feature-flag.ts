import { useEffect, useState } from 'react';
import {
  getLocalMobileFeatureFlagFallback,
  parseBooleanFeatureFlag,
  type MobileFeatureFlagKey,
} from '@/lib/feature-flags';
import { useMobileFeatureFlagClient } from '@/providers/mobile-feature-flags-provider';

export function useMobileFeatureFlag(key: MobileFeatureFlagKey): boolean {
  const posthog = useMobileFeatureFlagClient();
  const [enabled, setEnabled] = useState(() => getLocalMobileFeatureFlagFallback(key));

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      const fallback = getLocalMobileFeatureFlagFallback(key);
      if (!posthog) {
        setEnabled(fallback);
        return;
      }

      try {
        await posthog.reloadFeatureFlags?.();
        const value = posthog.isFeatureEnabled
          ? await posthog.isFeatureEnabled(key)
          : await posthog.getFeatureFlag?.(key);

        if (!cancelled) {
          setEnabled(parseBooleanFeatureFlag(value) || fallback);
        }
      } catch {
        if (!cancelled) {
          setEnabled(fallback);
        }
      }
    }

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, [key, posthog]);

  return enabled;
}
