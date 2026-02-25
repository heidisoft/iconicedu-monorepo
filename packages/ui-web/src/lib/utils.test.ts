import { describe, expect, it } from 'vitest';

import { getInitials } from './utils';

describe('getInitials', () => {
  it('uses one letter by default', () => {
    expect(getInitials('John Doe')).toBe('J');
    expect(getInitials('alice')).toBe('A');
  });

  it('supports explicit letter count override', () => {
    expect(getInitials('John Doe', 2)).toBe('JD');
  });
});
