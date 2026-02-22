import { getOAuthButtonLabel } from '@iconicedu/web/app/(auth)/shared/auth-entry-form';

describe('getOAuthButtonLabel', () => {
  it('returns default label when not loading', () => {
    expect(getOAuthButtonLabel('google', false)).toBe('Continue with Google');
    expect(getOAuthButtonLabel('apple', false)).toBe('Continue with Apple');
  });

  it('returns loading label when loading', () => {
    expect(getOAuthButtonLabel('google', true)).toBe('Continuing with Google...');
    expect(getOAuthButtonLabel('apple', true)).toBe('Continuing with Apple...');
  });
});
