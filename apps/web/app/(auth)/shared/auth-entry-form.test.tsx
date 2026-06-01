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
});
