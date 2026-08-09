import { describe, expect, it } from 'vitest';

import { resolveTurnstileSiteKey } from './turnstile-config';

describe('resolveTurnstileSiteKey', () => {
  it('keeps Turnstile off without requiring configuration', () => {
    expect(resolveTurnstileSiteKey(false, {})).toBeUndefined();
  });

  it('returns the configured site key when enabled', () => {
    expect(
      resolveTurnstileSiteKey(true, {
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: ' site-key ',
      }),
    ).toBe('site-key');
  });

  it('fails closed when enabled without a site key', () => {
    expect(() => resolveTurnstileSiteKey(true, {})).toThrow(
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY is required',
    );
  });
});
