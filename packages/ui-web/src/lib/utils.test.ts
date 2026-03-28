import { describe, expect, it } from 'vitest';

import { getInitials } from './utils';

describe('getInitials', () => {
  it('uses two letters by default', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('alice')).toBe('AL');
  });

  it('supports explicit letter count override', () => {
    expect(getInitials('John Doe', 2)).toBe('JD');
  });
});
