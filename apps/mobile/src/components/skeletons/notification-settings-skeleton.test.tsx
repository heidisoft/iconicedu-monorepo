import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { NotificationSettingsSkeleton } from './notification-settings-skeleton';

describe('NotificationSettingsSkeleton', () => {
  it('renders without crashing', () => {
    render(<NotificationSettingsSkeleton />);
  });

  it('has accessibilityLabel="Loading" on root', () => {
    render(<NotificationSettingsSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('renders the default number of placeholders', () => {
    render(<NotificationSettingsSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBe(18);
  });

  it('renders a custom category count', () => {
    render(<NotificationSettingsSkeleton categoryCount={2} />);
    expect(screen.getAllByLabelText('Loading').length).toBe(12);
  });
});
