import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MarketingHeader } from './marketing-header';
import { MarketingHomePage } from './marketing-home-page';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
  }),
}));

describe('marketing components', () => {
  it('renders marketing header navigation and cta', () => {
    const { container } = render(<MarketingHeader loginHref="/acme/login" />);

    expect(container.querySelector('header')).toHaveClass('bg-emerald-50/70');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(
      '0 0 215.11 77.39',
    );
    expect(
      screen.getByRole('button', { name: 'Toggle theme (current: system)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '#home');
    expect(screen.getByRole('link', { name: 'Log In' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('renders dashboard cta when user is authenticated', () => {
    render(<MarketingHeader isAuthenticated />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/get-started',
    );
  });

  it('renders marketing home page with primary cta and footer links', () => {
    render(<MarketingHomePage loginHref="/acme/login" />);

    expect(
      screen.getByRole('heading', { name: /It's time to unlock your .* potential/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start your journey now' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
    expect(screen.getAllByRole('link', { name: 'Become a Tutor' })).toHaveLength(2);
    for (const link of screen.getAllByRole('link', { name: 'Become a Tutor' })) {
      expect(link).toHaveAttribute('href', '/acme/login');
    }
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
