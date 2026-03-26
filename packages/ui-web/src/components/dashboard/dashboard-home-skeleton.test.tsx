import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardHomeSkeleton } from './dashboard-home-skeleton';

describe('DashboardHomeSkeleton', () => {
  it('renders the current homepage loading regions', () => {
    render(<DashboardHomeSkeleton />);

    expect(screen.getByRole('region', { name: 'Home loading' })).toBeInTheDocument();

    const metrics = screen.getByTestId('home-skeleton-metrics');
    const upcomingSessions = screen.getByTestId('home-skeleton-upcoming-sessions');
    const quickActions = screen.getByTestId('home-skeleton-quick-actions');

    expect(metrics.querySelectorAll('article')).toHaveLength(4);
    expect(upcomingSessions.querySelectorAll('div').length).toBeGreaterThan(0);
    expect(quickActions.querySelectorAll('div').length).toBeGreaterThan(0);
  });
});
