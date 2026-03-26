import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
const getDefaultOrgMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@iconicedu/web/lib/org/queries/org.query', () => ({
  getDefaultOrg: (...args: unknown[]) => getDefaultOrgMock(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}));

import DefaultOrgEntryPage from '@iconicedu/web/app/i/page';

describe('/i default org entry page', () => {
  it('redirects to the default org login page when an org exists', async () => {
    getDefaultOrgMock.mockResolvedValueOnce({ data: { slug: 'iconic-academy' } });

    await expect(DefaultOrgEntryPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/iconic-academy/login');
  });

  it('redirects to marketing homepage when no org exists', async () => {
    getDefaultOrgMock.mockResolvedValueOnce({ data: null });

    await expect(DefaultOrgEntryPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/');
  });
});
