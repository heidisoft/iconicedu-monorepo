import React, { createContext, useContext } from 'react';

export type MobileFeatureFlagClient = {
  isFeatureEnabled?: (key: string) => boolean | Promise<boolean>;
  getFeatureFlag?: (key: string) => unknown | Promise<unknown>;
  /** The JSON payload attached to a flag (independent of its boolean/variant value) — used for non-boolean config flags like the min-app-version nudge. */
  getFeatureFlagPayload?: (key: string) => unknown | Promise<unknown>;
  /** Fire-and-forget — resolves before the network refresh completes. Prefer reloadFeatureFlagsAsync when a caller needs to read a flag/payload right after reloading. */
  reloadFeatureFlags?: () => void | Promise<void>;
  /** Resolves once the refresh has actually completed and persisted — safe to read a flag/payload immediately after. */
  reloadFeatureFlagsAsync?: () => Promise<unknown>;
};

const MobileFeatureFlagClientContext = createContext<MobileFeatureFlagClient | null>(
  null,
);

export function MobileFeatureFlagsProvider({
  children,
  client,
}: {
  children: React.ReactNode;
  client: MobileFeatureFlagClient | null;
}) {
  return (
    <MobileFeatureFlagClientContext.Provider value={client}>
      {children}
    </MobileFeatureFlagClientContext.Provider>
  );
}

export function useMobileFeatureFlagClient() {
  return useContext(MobileFeatureFlagClientContext);
}
