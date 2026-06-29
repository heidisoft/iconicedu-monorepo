// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AuthEntryForm } from './auth-entry-form';

const BASE_PROPS = {
  title: 'Sign in',
  subtitle: 'Welcome back.',
  introText: 'Use your email.',
  trustLine: 'Secure login.',
};

describe('AuthEntryForm', () => {
  it('hides social login buttons and separator when both social providers are disabled', () => {
    render(
      <AuthEntryForm
        {...BASE_PROPS}
        enableGoogleSignIn={false}
        enableAppleSignIn={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /Google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apple/i })).not.toBeInTheDocument();
    expect(screen.queryByText('OR')).not.toBeInTheDocument();
  });

  it('shows the separator when at least one social provider is enabled', () => {
    render(
      <AuthEntryForm {...BASE_PROPS} enableGoogleSignIn enableAppleSignIn={false} />,
    );

    expect(screen.getByRole('button', { name: 'Login with Google' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Login with Apple' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('renders the requested email placeholder, feature bullets, and footer copy', () => {
    render(
      <AuthEntryForm
        {...BASE_PROPS}
        featureBullets={[
          'Qualified, vetted tutors',
          'Schedules, sessions & homework in one place',
          'Real-time messages, updates & payments',
        ]}
      />,
    );

    expect(screen.getByText('Welcome to ICONIC Academy.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@email.com')).toBeInTheDocument();
    expect(screen.getByText('Qualified, vetted tutors')).toBeInTheDocument();
    expect(
      screen.getByText('Schedules, sessions & homework in one place'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Real-time messages, updates & payments'),
    ).toBeInTheDocument();
    expect(screen.getByText(/By continuing, you agree to our/i)).toBeInTheDocument();
  });
});
