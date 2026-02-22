import { describe, expect, it } from 'vitest';

import { getPhoneValidationError } from './account-tab.utils';

describe('getPhoneValidationError', () => {
  it('returns required error when phone is missing and required', () => {
    expect(getPhoneValidationError('', { required: true })).toBe(
      'Please enter your phone number.',
    );
  });

  it('returns null when phone is missing and optional', () => {
    expect(getPhoneValidationError('', { required: false })).toBeNull();
  });

  it('returns validation error for invalid numbers', () => {
    expect(getPhoneValidationError('12345')).toBe(
      'Enter a valid international number (e.g. +1 415 555 0100).',
    );
  });

  it('returns null for valid international numbers', () => {
    expect(getPhoneValidationError('+1 415 555 0100')).toBeNull();
  });
});
