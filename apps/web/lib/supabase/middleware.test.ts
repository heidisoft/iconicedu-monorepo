import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('@iconicedu/web/lib/config/env', () => ({
  getPublicWebEnv: () => ({
    supabaseUrl: 'https://project.supabase.test',
    supabasePublishableKey: 'publishable-key',
  }),
}));

import { refreshSupabaseSession } from '@iconicedu/web/lib/supabase/middleware';
import { config, middleware } from '../../middleware';

describe('refreshSupabaseSession', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it('validates sessions without redirecting when no cookie refresh is needed', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    createServerClientMock.mockReturnValue({ auth: { getUser } });
    const request = new NextRequest('https://app.iconicedu.test/login');

    const response = await refreshSupabaseSession(request);

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBeNull();
  });

  it('copies refreshed cookies to both the request and response', async () => {
    createServerClientMock.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            setAll: (
              cookies: Array<{
                name: string;
                value: string;
                options: Record<string, unknown>;
              }>,
            ) => void;
          };
        },
      ) => ({
        auth: {
          getUser: vi.fn(async () => {
            options.cookies.setAll([
              {
                name: 'sb-session',
                value: 'rotated-session',
                options: { path: '/', httpOnly: false, sameSite: 'lax' },
              },
            ]);
            return { data: { user: { id: 'test-user' } }, error: null };
          }),
        },
      }),
    );
    const request = new NextRequest('https://app.iconicedu.test/acme');

    const response = await middleware(request);

    expect(request.cookies.get('sb-session')?.value).toBe('rotated-session');
    expect(response.cookies.get('sb-session')?.value).toBe('rotated-session');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain('Cookie');
  });

  it('excludes static assets and unauthenticated webhooks from the matcher', () => {
    expect(config.matcher[0]).toContain('_next/static');
    expect(config.matcher[0]).toContain('_next/image');
    expect(config.matcher[0]).toContain('api/webhooks');
  });
});
