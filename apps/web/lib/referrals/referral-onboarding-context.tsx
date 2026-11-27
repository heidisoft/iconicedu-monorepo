'use client';
import { createContext, useContext } from 'react';
export const ReferralOnboardingContext = createContext({
  enabled: false,
  referrerName: '',
});
export const useReferralOnboarding = () => useContext(ReferralOnboardingContext);
export function ReferralOnboardingProvider({
  enabled,
  referrerName,
  children,
}: {
  enabled: boolean;
  referrerName: string;
  children: React.ReactNode;
}) {
  return (
    <ReferralOnboardingContext.Provider value={{ enabled, referrerName }}>
      {children}
    </ReferralOnboardingContext.Provider>
  );
}
