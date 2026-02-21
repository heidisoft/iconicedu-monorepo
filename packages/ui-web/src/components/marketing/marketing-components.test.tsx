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
    const { container } = render(<MarketingHeader />);

    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 215.11 77.39');
    expect(screen.getByRole('button', { name: 'Toggle theme (current: system)' })).toBeInTheDocument();
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
