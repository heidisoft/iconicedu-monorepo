import React from 'react';
import { render, screen } from '@testing-library/react';

import HomePage from '@iconicedu/web/app/(marketing)/page';

describe('marketing home page', () => {
  it('renders the tutor discovery hero and primary CTA', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { name: /It's time to unlock your .* potential/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start your journey now' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('shows learning area pills and footer navigation links', () => {
    render(<HomePage />);

    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Competition Prep')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Programs' })).toHaveAttribute('href', '#subjects');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });
});
