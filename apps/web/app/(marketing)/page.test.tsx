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
      screen.getByRole('heading', {
        name: 'Personalized K-12 tutoring for school success, confidence, and future-ready skills',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find the right tutor' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('shows learning area pills and footer navigation links', async () => {
    createSupabaseServerClientMock.mockResolvedValueOnce({ auth: { getUser: vi.fn() } });
    resolveDefaultOrgLoginPathMock.mockResolvedValueOnce('/acme/login');

    render(await HomePage());

    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Financial Literacy')).toBeInTheDocument();
    expect(screen.getAllByText('Affordable learning options').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Parent-first communication').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Questions families ask before starting online tutoring'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore and sign up' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });
});
