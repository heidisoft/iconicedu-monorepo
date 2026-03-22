import { describe, expect, it } from 'vitest';

import { getPublicWebEnv, getServiceWebEnv } from './env';

describe('web env config', () => {
  it('reads the public supabase env', () => {
    expect(
      getPublicWebEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'publishable-key',
    });
  });

  it('accepts SUPABASE_URL (Vercel connector server-side name) as url fallback', () => {
    expect(
      getPublicWebEnv({
        SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'publishable-key',
    });
  });

  it('falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY when needed', () => {
    expect(
      getPublicWebEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'anon-key',
    });
  });

  it('throws on missing or invalid public env', () => {
    expect(() =>
      getPublicWebEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toThrow('Environment variable NEXT_PUBLIC_SUPABASE_URL must be a valid URL');

    expect(() =>
      getPublicWebEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toThrow('Missing required environment variable');
  });

  it('requires the service role key for server-only admin access', () => {
    expect(
      getServiceWebEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      }),
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'publishable-key',
      supabaseServiceRoleKey: 'service-role-key',
    });

    expect(() =>
      getServiceWebEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toThrow('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  });
});
