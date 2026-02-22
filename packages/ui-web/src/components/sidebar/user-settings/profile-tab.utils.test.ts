import { describe, expect, it } from 'vitest';

import { resolveProfileDisplayNameForSave } from './profile-tab.utils';

describe('resolveProfileDisplayNameForSave', () => {
  it('uses first name and last initial during onboarding', () => {
    expect(
      resolveProfileDisplayNameForSave({
        firstName: 'Maya',
        lastName: 'Johnson',
        displayName: 'Maya Johnson',
        isOnboarding: true,
      }),
    ).toBe('Maya J');
  });

  it('preserves explicit display name outside onboarding', () => {
    expect(
      resolveProfileDisplayNameForSave({
        firstName: 'Maya',
        lastName: 'Johnson',
        displayName: 'Maya Johnson',
        isOnboarding: false,
      }),
    ).toBe('Maya Johnson');
  });
});
