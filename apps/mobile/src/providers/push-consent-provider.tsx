import React, { createContext, useContext, type ReactNode } from 'react';

import { PushPermissionSheet } from '@/components/notifications/push-permission-sheet';
import { usePushRegistration } from '@/hooks/use-push-registration';

type PushConsentContextValue = {
  requestPushConsent: () => Promise<boolean>;
};

const PushConsentContext = createContext<PushConsentContextValue>({
  requestPushConsent: async () => false,
});

export function PushConsentProvider({ children }: { children: ReactNode }) {
  const { showConsent, requestConsent, onConsentGranted, onConsentDismissed } =
    usePushRegistration();

  return (
    <PushConsentContext.Provider value={{ requestPushConsent: requestConsent }}>
      {children}
      <PushPermissionSheet
        visible={showConsent}
        onEnable={onConsentGranted}
        onDismiss={onConsentDismissed}
      />
    </PushConsentContext.Provider>
  );
}

export function usePushConsent() {
  return useContext(PushConsentContext);
}
