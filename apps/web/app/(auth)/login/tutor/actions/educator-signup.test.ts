import { describe, expect, it } from 'vitest';

import { resolveSignupDisplayName } from './educator-signup';

describe('resolveSignupDisplayName', () => {
  it('uses provided display name when present', () => {
    expect(
      resolveSignupDisplayName({
        displayName: 'Sara Parras',
        firstName: 'Sara',
        lastName: 'Parras',
      }),
    ).toBe('Sara Parras');
  });

  it('falls back to first name and last initial when display name is empty', () => {
    expect(
      resolveSignupDisplayName({
        displayName: '   ',
        firstName: 'Sara',
        lastName: 'Parras',
      }),
    ).toBe('Sara P.');
  });

  it('falls back to first name when last name is empty', () => {
    expect(
      resolveSignupDisplayName({
        displayName: '',
        firstName: 'Sara',
        lastName: '',
      }),
    ).toBe('Sara');
  });
});
