import { describe, expect, it } from 'vitest';

import { getProfileDisplayName } from './display-name';

describe('getProfileDisplayName', () => {
  it('uses display name as-is when available', () => {
    expect(
      getProfileDisplayName({
        firstName: 'Sara',
        lastName: 'Parras',
        displayName: 'Sara Parras',
      }),
    ).toBe('Sara Parras');
  });

  it('falls back to first name when last name is missing', () => {
    expect(
      getProfileDisplayName({
        firstName: 'Sara',
        lastName: null,
      }),
    ).toBe('Sara');
  });

  it('falls back to first name + last initial when display name is missing', () => {
    expect(
      getProfileDisplayName({
        firstName: 'Maya',
        lastName: 'Johnson',
      }),
    ).toBe('Maya J.');
  });
});
