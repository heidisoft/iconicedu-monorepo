import React from 'react';
import { render, screen } from '@testing-library/react';

import { MarketingFooterSection } from './marketing-footer-section';
import { MarketingHeroSection } from './marketing-hero-section';
import { MarketingHowItWorksSection } from './marketing-how-it-works-section';
import { MarketingSubjectsSection } from './marketing-subjects-section';
import { MarketingTrustStatsSection } from './marketing-trust-stats-section';

describe('marketing sections', () => {
  it('renders hero section CTAs', () => {
    const { container } = render(<MarketingHeroSection loginHref="/acme/login" />);

    expect(
      screen.getByRole('heading', { name: /It's time to unlock your .* potential/i }),
    ).toBeInTheDocument();
    expect(container.querySelector('section#home')).toHaveClass('from-emerald-50/70');
    expect(screen.getByTestId('hero-background')).toBeInTheDocument();
    expect(screen.getByTestId('hero-pattern-cluster')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start your journey now' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('renders subjects carousel', () => {
    render(<MarketingSubjectsSection />);

    expect(
      screen.getByRole('region', { name: 'Hero subjects carousel' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Competition Prep')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeInTheDocument();
  });

  it('renders trust stats section cards', () => {
    render(<MarketingTrustStatsSection />);

    expect(screen.getByText('4.9/5')).toBeInTheDocument();
    expect(
      screen.getByText('Trusted by parents who see real results'),
    ).toBeInTheDocument();
  });

  it('renders how-it-works section content', () => {
    render(<MarketingHowItWorksSection loginHref="/acme/login" />);

    expect(
      screen.getByText('One platform for students, parents, and educators'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore and sign up' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('renders footer section links', () => {
    render(<MarketingFooterSection />);

    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Programs' })).toHaveAttribute(
      'href',
      '/regions/global-online',
    );
  });
});
