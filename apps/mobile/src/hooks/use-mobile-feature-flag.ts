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
    let version = 0;
    const unsubscribe = posthog?.onFeatureFlags?.((flags) => {
      version += 1;
      if (!cancelled)
        setEnabled(
          parseBooleanFeatureFlag(flags?.[key]) || getLocalMobileFeatureFlagFallback(key),
        );
    });

    async function evaluate() {
      const fallback = getLocalMobileFeatureFlagFallback(key);
      if (!posthog) {
        setEnabled(fallback);
        return;
      }

      const evaluationVersion = version;
      try {
        if (posthog.reloadFeatureFlagsAsync) await posthog.reloadFeatureFlagsAsync();
        else await posthog.reloadFeatureFlags?.();
        const value = posthog.isFeatureEnabled
          ? await posthog.isFeatureEnabled(key)
          : await posthog.getFeatureFlag?.(key);

        if (!cancelled && evaluationVersion === version) {
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
      unsubscribe?.();
    };
  }, [key, posthog]);

  return enabled;
}
