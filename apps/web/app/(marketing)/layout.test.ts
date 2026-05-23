import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { metadata } from './layout.metadata';
import SiteLayout from './layout';

const getUserMock = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@iconicedu/web/components/chat-widget-script', () => ({
  ChatWidgetScript: () => null,
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  })),
}));

vi.mock('@iconicedu/web/lib/org/resolve-auth-path', () => ({
  resolveDefaultOrgLoginPath: vi.fn(async () => '/acme/login'),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: vi.fn(async () => '/acme'),
}));

describe('marketing layout metadata', () => {
  it('defines SEO metadata for the marketing page', () => {
    expect(metadata.title).toBe('ICONIC Academy | Personalized Online Tutoring for K-12');
    expect(metadata.description).toContain('personalized online tutoring');
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph?.type).toBe('website');
    expect(metadata.twitter?.card).toBe('summary_large_image');
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('renders global marketing header and footer around pages', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    render(await SiteLayout({ children: React.createElement('div', null, 'Page body') }));

    expect(screen.getByText('Page body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subjects' })).toHaveAttribute(
      'href',
      '/subjects',
    );
    expect(screen.getByRole('link', { name: 'Log In' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Programs' })).toHaveAttribute(
      'href',
      '/subjects',
    );
  });
});
