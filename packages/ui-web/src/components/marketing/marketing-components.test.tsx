import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MarketingContactPage } from './marketing-contact-page';
import { MarketingHeader } from './marketing-header';
import { MarketingHomePage } from './marketing-home-page';
import { MarketingInfoPage } from './marketing-info-page';
import { MarketingPricingPage } from './marketing-pricing-page';
import { MarketingRegionalPage } from './marketing-regional-page';
import { MARKETING_INFO_PAGES, MARKETING_REGIONS } from './marketing-site-content';

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
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Log In' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('renders dashboard cta when user is authenticated', () => {
    render(<MarketingHeader isAuthenticated dashboardHref="/acme" />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/acme',
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

  it('renders reusable info pages with legal sections', () => {
    render(
      <MarketingInfoPage
        content={MARKETING_INFO_PAGES.privacy}
        loginHref="/acme/login"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('Information we collect')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('renders static contact links', () => {
    render(<MarketingContactPage loginHref="/acme/login" />);

    expect(
      screen.getByRole('heading', { name: 'Talk with ICONIC Academy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hello@iconicedu.com' })).toHaveAttribute(
      'href',
      'mailto:hello@iconicedu.com?subject=Program%20inquiry',
    );
    expect(screen.getByRole('link', { name: 'Open family portal' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('renders pricing page with request details cta', () => {
    render(<MarketingPricingPage loginHref="/acme/login" />);

    expect(
      screen.getByRole('heading', { name: 'Program pricing built around each learner' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Class sessions start from \$12\/hour/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Global tutor network')).toBeInTheDocument();
    expect(screen.getByText('Native-speaker subject expertise')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Regional specialization without losing global flexibility',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/native English speakers from the USA, Australia, and the UK/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request details' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('renders regional microsite content', () => {
    render(
      <MarketingRegionalPage region={MARKETING_REGIONS[0]} loginHref="/acme/login" />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Specialized online programs for families anywhere',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('K-12 academic support')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ask about regional programs' }),
    ).toHaveAttribute('href', '/acme/login');
  });
});
