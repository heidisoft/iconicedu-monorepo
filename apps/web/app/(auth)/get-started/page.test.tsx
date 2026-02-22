import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from '@iconicedu/web/app/(auth)/get-started/page';

const redirectMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  })),
}));

vi.mock('@iconicedu/web/app/(auth)/get-started/get-started-client', () => ({
  default: () => null,
}));

vi.mock('@iconicedu/web/app/(auth)/get-started/get-started-auth-client', () => ({
  default: () => null,
}));

describe('global get-started page', () => {
  beforeEach(() => {
    redirectMock.mockReset();
    getUserMock.mockReset();
  });

  it('renders create organization flow for authenticated users', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'auth-user-1' } } });
    const element = await Page();
    expect(element).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('renders auth form when orgs are empty and user is anonymous', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    const element = await Page();
    expect(element).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('renders create organization form for users without org account', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'auth-user-1' } } });

    const element = await Page();
    expect(element).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
