import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { MobileMinAppVersionPayload } from '@iconicedu/shared-types';
import { getAppStoreUrl } from '@/lib/app-store-links';
import { getMobileBuildInfo } from '@/lib/build-info';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import { isVersionAtLeast } from '@/lib/version-compare';
import { useMobileFeatureFlagClient } from '@/providers/mobile-feature-flags-provider';

const DEFAULT_MESSAGE =
  'A new version of the app is available. Update for the latest fixes and features.';

type UseMobileAppUpdateRequiredResult = {
  /** True once the running version falls below the platform's configured minimum and the banner hasn't been dismissed this session. */
  shouldShow: boolean;
  message: string;
  storeUrl: string;
  /** Session-only — reappears on the next app launch, since a stale build is still stale. */
  dismiss: () => void;
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * A PostHog flag payload is edited by hand on a dashboard, so nothing about
 * its shape is guaranteed — a field could be a number, an object, anything.
 * Every field is read through `asString` so a malformed edit degrades to
 * "that field is unset" instead of a non-string reaching a later
 * `.trim()` call (in isVersionAtLeast/getAppStoreUrl/the message getter)
 * and throwing outside this effect's try/catch.
 */
function parsePayload(value: unknown): MobileMinAppVersionPayload | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  return {
    ios: asString(raw.ios),
    android: asString(raw.android),
    message: asString(raw.message),
    iosUrl: asString(raw.iosUrl),
    androidUrl: asString(raw.androidUrl),
  };
}

/**
 * Drives the "update available" banner from the `mobile-min-app-version`
 * PostHog flag payload (see packages/shared-types/src/shared/mobile-app-update.ts).
 * Nudges rather than blocks — dismissing hides it for this session only, so a
 * user who ignores it keeps seeing it on every subsequent launch until they
 * actually update.
 */
export function useMobileAppUpdateRequired(): UseMobileAppUpdateRequiredResult {
  const client = useMobileFeatureFlagClient();
  const [payload, setPayload] = useState<MobileMinAppVersionPayload | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      if (!client) return;
      try {
        // reloadFeatureFlags() returns void and only *starts* the request —
        // reading the payload right after it would race the network call and
        // see stale/cached data on a first launch or right after the flag
        // changes. reloadFeatureFlagsAsync() resolves once the refresh (and
        // its persistence) actually completes.
        await client.reloadFeatureFlagsAsync?.();
        const value = await client.getFeatureFlagPayload?.(
          mobileFeatureFlagKeys.mobileMinAppVersion,
        );
        if (!cancelled) {
          setPayload(parsePayload(value));
        }
      } catch {
        // Update-nudge failure must never interrupt the user session.
      }
    }

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const minimumVersion = Platform.OS === 'android' ? payload?.android : payload?.ios;
  const currentVersion = getMobileBuildInfo().version;
  const shouldShow =
    !isDismissed &&
    Boolean(minimumVersion) &&
    !isVersionAtLeast(currentVersion, minimumVersion as string);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    shouldShow,
    message: payload?.message?.trim() || DEFAULT_MESSAGE,
    storeUrl: getAppStoreUrl(payload),
    dismiss,
  };
}
