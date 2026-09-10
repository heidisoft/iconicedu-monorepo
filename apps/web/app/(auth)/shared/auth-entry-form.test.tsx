// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AuthEntryForm } from './auth-entry-form';

// Mocked Turnstile widget: `configured` mirrors a set site key; `emit` is wired
// to the live `onTokenChange` so tests can push a token / expiry on demand.
const turnstileState = vi.hoisted(() => ({
  configured: false,
  emit: null as null | ((token: string | null) => void),
}));

vi.mock('./turnstile-field', async () => {
  const react = await import('react');
  return {
    isTurnstileConfigured: () => turnstileState.configured,
    TurnstileField: react.forwardRef(function MockTurnstileField(
      { onTokenChange }: { onTokenChange: (token: string | null) => void },
      ref: react.Ref<{ reset: () => void }>,
    ) {
      react.useImperativeHandle(ref, () => ({ reset: () => onTokenChange(null) }), [
        onTokenChange,
      ]);
      react.useEffect(() => {
        turnstileState.emit = onTokenChange;
        return () => {
          turnstileState.emit = null;
        };
      }, [onTokenChange]);
      return null;
    }),
  };
});

const BASE_PROPS = {
  title: 'Sign in',
  subtitle: 'Welcome back.',
  introText: 'Use your email.',
  trustLine: 'Secure login.',
};

afterEach(() => {
  turnstileState.configured = false;
  turnstileState.emit = null;
});

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

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByText('Qualified, vetted tutors')).toBeInTheDocument();
    expect(
      screen.getByText('Schedules, sessions & homework in one place'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Real-time messages, updates & payments'),
    ).toBeInTheDocument();
    expect(screen.getByText(/By continuing, you agree to our/i)).toBeInTheDocument();
  });

  it('requires a valid email before submitting', async () => {
    const onEmailLogin = vi.fn();
    render(
      <AuthEntryForm
        {...BASE_PROPS}
        onEmailLogin={onEmailLogin}
        enableGoogleSignIn={false}
        enableAppleSignIn={false}
      />,
    );

    const emailInput = screen.getByPlaceholderText('Email');
    const submitButton = screen.getByRole('button', { name: 'Send code' });

    expect(submitButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.blur(emailInput);

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: ' parent@example.com ' } });
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onEmailLogin).toHaveBeenCalledWith('parent@example.com', null);
    });
  });

  it('blocks submission until Turnstile yields a token, then forwards it', async () => {
    turnstileState.configured = true;

    const onEmailLogin = vi.fn();
    render(
      <AuthEntryForm
        {...BASE_PROPS}
        onEmailLogin={onEmailLogin}
        enableGoogleSignIn={false}
        enableAppleSignIn={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'parent@example.com' },
    });

    const submitButton = screen.getByRole('button', { name: 'Send code' });
    // Valid email but no captcha token yet -> still blocked.
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Verifying your browser…')).toBeInTheDocument();

    // Widget solves and delivers a token.
    act(() => turnstileState.emit?.('tk-live'));

    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onEmailLogin).toHaveBeenCalledWith('parent@example.com', 'tk-live');
    });
  });
});
