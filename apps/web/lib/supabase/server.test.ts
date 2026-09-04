import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(() => ({ id: 'supabase-server-client' })),
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

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

describe('createSupabaseServerClient', () => {
  beforeEach(() => {
    createServerClientMock.mockClear();
  });

  it('uses the non-deprecated getAll cookie adapter', async () => {
    const cookieStore = {
      getAll: vi.fn(() => [{ name: 'session-cookie', value: 'session-value' }]),
      set: vi.fn(),
    };

    await createSupabaseServerClient({ cookieStore: cookieStore as never });

    const options = createServerClientMock.mock.calls[0]?.[2] as {
      cookies: { getAll: () => unknown; setAll: (values: unknown[]) => void };
    };
    expect(options.cookies.getAll()).toEqual([
      { name: 'session-cookie', value: 'session-value' },
    ]);

    options.cookies.setAll([
      { name: 'updated-cookie', value: 'updated-value', options: { path: '/' } },
    ]);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('writes refreshed cookies in mutable server contexts', async () => {
    const cookieStore = {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    };

    await createSupabaseServerClient({
      cookieStore: cookieStore as never,
      allowCookieModification: true,
    });

    const options = createServerClientMock.mock.calls[0]?.[2] as {
      cookies: {
        setAll: (
          values: Array<{
            name: string;
            value: string;
            options: { path: string; maxAge?: number };
          }>,
        ) => void;
      };
    };
    options.cookies.setAll([
      {
        name: 'updated-cookie',
        value: 'updated-value',
        options: { path: '/', maxAge: 3600 },
      },
    ]);

    expect(cookieStore.set).toHaveBeenCalledWith({
      name: 'updated-cookie',
      value: 'updated-value',
      path: '/',
      maxAge: 3600,
    });
  });
});
