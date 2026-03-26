import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import HomePage from '@iconicedu/web/app/(marketing)/page';

const createSupabaseServerClientMock = vi.fn();
const resolveDefaultOrgLoginPathMock = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/resolve-auth-path', () => ({
  resolveDefaultOrgLoginPath: (...args: unknown[]) =>
    resolveDefaultOrgLoginPathMock(...args),
}));

describe('marketing home page', () => {
  it('renders the tutor discovery hero and primary CTA', async () => {
    createSupabaseServerClientMock.mockResolvedValueOnce({ auth: { getUser: vi.fn() } });
    resolveDefaultOrgLoginPathMock.mockResolvedValueOnce('/acme/login');

    render(await HomePage());

    expect(
      screen.getByRole('heading', { name: /It's time to unlock your .* potential/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start your journey now' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('shows learning area pills and footer navigation links', async () => {
    createSupabaseServerClientMock.mockResolvedValueOnce({ auth: { getUser: vi.fn() } });
    resolveDefaultOrgLoginPathMock.mockResolvedValueOnce('/acme/login');

    render(await HomePage());

    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Competition Prep')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Programs' })).toHaveAttribute(
      'href',
      '#subjects',
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
