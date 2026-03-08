/**
 * Vendor-agnostic feature flag catalog for the mobile app.
 *
 * Mirrors the pattern used in apps/web/flags.ts — flags are defined here
 * with a key, description, and defaultValue. The evaluation engine
 * (PostHog) is wired up separately in feature-flags-provider.tsx so this
 * file has zero vendor dependencies.
 */

export type MobileFlagKey = 'enable-quick-access';

export interface MobileFlagDefinition {
  key: MobileFlagKey;
  description: string;
  /** Returned when the flag hasn't loaded yet or the SDK isn't configured. */
  defaultValue: boolean;
}

export const mobileFlags: Record<MobileFlagKey, MobileFlagDefinition> = {
  'enable-quick-access': {
    key: 'enable-quick-access',
    description: 'Shows the Quick Access grid section on the home screen.',
    defaultValue: false,
  },
};
