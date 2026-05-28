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
    expect(container.querySelector('[aria-label="Open menu"]')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tutoring' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Programs' })[0]).toHaveAttribute(
      'href',
      '/programs',
    );
    expect(screen.getAllByRole('link', { name: 'How It Works' })[0]).toHaveAttribute(
      'href',
      '/how-it-works',
    );
    expect(screen.getAllByRole('link', { name: 'For Parents' })[0]).toHaveAttribute(
      'href',
      '/for-parents',
    );
    expect(screen.getAllByRole('link', { name: 'Pricing' })[0]).toHaveAttribute(
      'href',
      '/pricing',
    );
    expect(screen.getAllByRole('link', { name: 'Contact' })[0]).toHaveAttribute(
      'href',
      '/contact',
    );
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
      screen.getByRole('heading', {
        name: "It's time to unlock your child's potential in",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Personalized K-12 tutoring for school success, confidence, and future-ready skills.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Why families choose ICONIC Academy')).toBeInTheDocument();
    expect(
      screen.getByText('Support for students across every U.S. state'),
    ).toBeInTheDocument();
    expect(screen.getByText("A clear path for your child's success")).toBeInTheDocument();
    expect(screen.getByText('Request a trial class')).toBeInTheDocument();
    expect(screen.getByText('Book a free learning match call')).toBeInTheDocument();
    expect(screen.getByText('Need homework help this week?')).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Find the right tutor' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
    expect(screen.getByRole('link', { name: 'Explore programs' })).toHaveAttribute(
      'href',
      '/programs',
    );
  });

  it('renders mobile store links in the footer', () => {
    render(<MarketingFooterSection loginHref="/acme/login" />);

    expect(
      screen.getByText('New York, NY, USA · Colombo, Sri Lanka'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+1 (929) 900-1264' })).toHaveAttribute(
      'href',
      'tel:+19299001264',
    );
    expect(screen.getByRole('link', { name: '+94 70 170 7926' })).toHaveAttribute(
      'href',
      'https://wa.me/94701707926',
    );
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
        name: 'Tutoring that keeps parents informed — not guessing',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Is my child actually improving?')).toBeInTheDocument();
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
    expect(screen.getByText('Request a trial class')).toBeInTheDocument();
    expect(screen.getByText('Book a free learning match call')).toBeInTheDocument();
    expect(screen.getByText('Need homework help this week?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+1 (929) 900-1264' })).toHaveAttribute(
      'href',
      'tel:+19299001264',
    );
    expect(screen.getByRole('link', { name: '+94 70 170 7926' })).toHaveAttribute(
      'href',
      'https://wa.me/94701707926',
    );
    expect(
      screen.getByText('New York, NY, USA · Colombo, Sri Lanka'),
    ).toBeInTheDocument();
  });

  it('renders pricing page with request details cta', () => {
    render(<MarketingPricingPage loginHref="/acme/login" />);

    expect(
      screen.getByRole('heading', { name: 'Flexible tutoring options for every family' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Class sessions start from \$12\/hour/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Global Tutor Plan')).toBeInTheDocument();
    expect(screen.getByText('USA Curriculum Plan')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Regional specialization without losing global flexibility',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/USA-based or native English-speaking tutors/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request details' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
    expect(screen.getByText('Request a trial class')).toBeInTheDocument();
    expect(screen.getByText('Book a free learning match call')).toBeInTheDocument();
    expect(screen.getByText('Need homework help this week?')).toBeInTheDocument();
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
