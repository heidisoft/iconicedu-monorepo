jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

import { getMobilePostHogEnv, getMobilePublicEnv, validateMobileRuntimeEnv } from './env';

describe('mobile env config', () => {
  it('reads Supabase config from Expo extra first', () => {
    expect(
      getMobilePublicEnv({
        expoExtra: {
          supabaseUrl: 'http://127.0.0.1:54321',
          supabaseAnonKey: 'local-anon-key',
        },
        processEnv: {},
      }),
    ).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseAnonKey: 'local-anon-key',
    });
  });

  it('falls back to process env values', () => {
    expect(
      getMobilePublicEnv({
        expoExtra: {},
        processEnv: {
          EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
          EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        },
      }),
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
    });
  });

  it('throws for missing runtime config outside tests', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    expect(() =>
      validateMobileRuntimeEnv({
        expoExtra: {},
        processEnv: {},
      }),
    ).toThrow('Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL');

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('uses a default PostHog host when only the key is provided', () => {
    expect(
      getMobilePostHogEnv({
        expoExtra: { posthogKey: 'ph_test_key' },
        processEnv: {},
      }),
    ).toEqual({
      posthogKey: 'ph_test_key',
      posthogHost: 'https://us.i.posthog.com',
    });
  });
});
