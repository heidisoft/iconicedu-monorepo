import React from 'react';
import { render, screen } from '@testing-library/react';

import { MarketingHeader } from './marketing-header';
import { MarketingHomePage } from './marketing-home-page';

describe('marketing components', () => {
  it('renders marketing header navigation and cta', () => {
    render(<MarketingHeader />);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '#home');
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/login');
  });

  it('renders marketing home page with primary cta and footer links', () => {
    render(<MarketingHomePage />);

    expect(
      screen.getByRole('heading', { name: /It's time to unlock your .* potential/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start your journey now' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });
});
