import { act, renderHook } from '@testing-library/react-native';

import { useTurnstile } from './use-turnstile';

const SITE_KEY_ENV = 'EXPO_PUBLIC_TURNSTILE_SITE_KEY';

afterEach(() => {
  delete process.env[SITE_KEY_ENV];
});

describe('useTurnstile', () => {
  it('is not required and renders no widget without a site key', () => {
    delete process.env[SITE_KEY_ENV];
    const { result } = renderHook(() => useTurnstile());

    expect(result.current.required).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.widget).toBeNull();
  });

  it('is required and renders a widget when a site key is set', () => {
    process.env[SITE_KEY_ENV] = '1x00000000000000000000AA';
    const { result } = renderHook(() => useTurnstile());

    expect(result.current.required).toBe(true);
    expect(result.current.widget).not.toBeNull();
  });

  it('reset() clears the held token', () => {
    process.env[SITE_KEY_ENV] = '1x00000000000000000000AA';
    const { result } = renderHook(() => useTurnstile());

    act(() => {
      result.current.reset();
    });

    expect(result.current.token).toBeNull();
  });
});
