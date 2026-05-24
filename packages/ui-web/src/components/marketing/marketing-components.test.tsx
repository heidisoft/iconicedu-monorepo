import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MarketingContactPage } from './marketing-contact-page';
import { MarketingFooterSection } from './marketing-footer-section';
import { MarketingHeader } from './marketing-header';
import { MarketingHomePage } from './marketing-home-page';
import { MarketingInfoPage } from './marketing-info-page';
import { MarketingMainMenuPage } from './marketing-main-menu-page';
import { MarketingPricingPage } from './marketing-pricing-page';
import { MarketingRegionalPage } from './marketing-regional-page';
import { MAIN_MENU_PAGE_CONTENT } from './marketing.constants';
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
    expect(screen.getByRole('link', { name: 'Subjects' })).toHaveAttribute(
      'href',
      '/subjects',
    );
    expect(screen.getByRole('link', { name: 'How It Works' })).toHaveAttribute(
      'href',
      '/how-it-works',
    );
    expect(screen.getByRole('link', { name: 'For Parents' })).toHaveAttribute(
      'href',
      '/for-parents',
    );
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
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
    expect(screen.getAllByText('Affordable learning options').length).toBeGreaterThan(0);
    expect(screen.getByText('Built for a wider audience')).toBeInTheDocument();
    expect(screen.getByText('USA and global tutor access')).toBeInTheDocument();
    expect(screen.getByText('Mobile apps')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Download on the App Store' }),
    ).toHaveAttribute(
      'href',
      'https://apps.apple.com/us/app/iconic-academy/id6762158186',
    );
    expect(screen.getByRole('link', { name: 'Get it on Google Play' })).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.heidisoft.iconicedu',
    );
    expect(screen.getByRole('link', { name: 'Start your journey now' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
    expect(screen.getAllByRole('link', { name: 'Become a Tutor' })).toHaveLength(1);
    for (const link of screen.getAllByRole('link', { name: 'Become a Tutor' })) {
      expect(link).toHaveAttribute('href', '/acme/login');
    }
  });

  it('renders mobile store links in the footer', () => {
    render(<MarketingFooterSection loginHref="/acme/login" />);

    expect(
      screen.getByRole('link', { name: 'Download on the App Store' }),
    ).toHaveAttribute(
      'href',
      'https://apps.apple.com/us/app/iconic-academy/id6762158186',
    );
    expect(screen.getByRole('link', { name: 'Get it on Google Play' })).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.heidisoft.iconicedu',
    );
  });

  it('renders main menu content pages', () => {
    render(
      <MarketingMainMenuPage
        content={MAIN_MENU_PAGE_CONTENT.forParents}
        loginHref="/acme/login"
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Built for parents who want clarity, care, and affordability',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Clear communication')).toBeInTheDocument();
    expect(
      screen.getByText(/Class updates help parents understand/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Parents deserve to feel informed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/acme/login',
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
    expect(screen.getByText('USA curriculum expertise')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Regional specialization without losing global flexibility',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/USA-based and native English-speaking tutors/i),
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
