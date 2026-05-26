import React, { createContext, useContext } from 'react';

export type MobileFeatureFlagClient = {
  isFeatureEnabled?: (key: string) => boolean | Promise<boolean>;
  getFeatureFlag?: (key: string) => unknown | Promise<unknown>;
  reloadFeatureFlags?: () => void | Promise<void>;
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
